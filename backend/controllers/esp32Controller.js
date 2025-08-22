const Device = require('../models/Device');
const ActivityLog = require('../models/ActivityLog');
const { logger } = require('../middleware/logger');
const securityService = require('../services/securityService');

const DEVICE_TIMEOUT = 60000; // 1 minute timeout
const MAX_RETRIES = 3;
const RECONNECT_INTERVAL = 5000; // 5 seconds
const MAX_RECONNECT_ATTEMPTS = 5;

class SecurityError extends Error {
    constructor(message = 'Security check failed') {
        super(message);
        this.name = 'SecurityError';
    }
}

class WebSocketHandler {
    constructor(io) {
        this.io = io;
        this.connectedDevices = new Map();
        this.reconnectAttempts = new Map();
        
        // Start security service cleanup
        setInterval(() => securityService.cleanup(), 3600000); // Clean every hour
    }

    async handleConnection(socket) {
        logger.info(`New WebSocket connection attempt`);
        const clientIp = socket.handshake.address;
        
        // Check rate limiting for IP
        if (!await securityService.checkRateLimit(clientIp, 100, 60000)) {
            logger.warn(`Rate limit exceeded for IP ${clientIp}`);
            socket.disconnect(true);
            return;
        }
        
        socket.on('identify', async (data) => {
            try {
                // Validate device token
                const deviceId = data.deviceId;
                if (!deviceId || !data.token || securityService.isBlacklisted(deviceId)) {
                    throw new SecurityError('Invalid device identification');
                }

                const verified = securityService.verifyDeviceToken(data.token, process.env.DEVICE_SECRET);
                if (!verified) {
                    securityService.trackActivity(deviceId, { type: 'auth_failure' });
                    throw new SecurityError('Invalid device token');
                }
                await this.handleIdentify(socket, data);
            } catch (err) {
                logger.error('Identification error:', err);
                socket.emit('error', { code: 'identify_failed', message: err.message });
            }
        });

        socket.on('disconnect', () => this.handleDisconnect(socket));
        socket.on('heartbeat', (data) => this.handleHeartbeat(socket, data));
        socket.on('state_update', (data) => this.handleStateUpdate(socket, data));
    }

    async handleIdentify(socket, data) {
        const { mac, secret } = data;
        if (!mac || !secret) {
            throw new Error('Missing mac or secret');
        }

        const device = await Device.findOne({ macAddress: mac });
        if (!device || device.secret !== secret) {
            throw new Error('Invalid device credentials');
        }

        // Reset reconnection attempts on successful identification
        this.reconnectAttempts.delete(mac);
        this.connectedDevices.set(mac, { socket, device });

        device.isIdentified = true;
        device.lastSeen = new Date();
        device.connectionStatus = 'online';
        await device.save();

        logger.info(`Device identified: ${mac}`);
        
        socket.deviceMac = mac;
        socket.emit('identified', {
            success: true,
            config: await this.generateDeviceConfig(device)
        });

        // Notify frontend about device connection
        this.io.emit('device_status', {
            mac,
            status: 'online',
            timestamp: new Date()
        });
    }

    async handleDisconnect(socket) {
        if (!socket.deviceMac) return;

        const device = await Device.findOne({ macAddress: socket.deviceMac });
        if (device) {
            device.connectionStatus = 'disconnected';
            device.isIdentified = false;
            await device.save();

            // Start reconnection process
            this.attemptReconnect(socket.deviceMac);
        }

        this.connectedDevices.delete(socket.deviceMac);
        logger.info(`Device disconnected: ${socket.deviceMac}`);
    }

    async attemptReconnect(mac) {
        const attempts = this.reconnectAttempts.get(mac) || 0;
        if (attempts >= MAX_RECONNECT_ATTEMPTS) {
            logger.error(`Max reconnection attempts reached for device: ${mac}`);
            return;
        }

        this.reconnectAttempts.set(mac, attempts + 1);
        setTimeout(async () => {
            const device = await Device.findOne({ macAddress: mac });
            if (device && !this.connectedDevices.has(mac)) {
                // Device still not reconnected, try again
                this.attemptReconnect(mac);
            }
        }, RECONNECT_INTERVAL);
    }

    async handleHeartbeat(socket, data) {
        if (!socket.deviceMac) return;

        const device = await Device.findOne({ macAddress: socket.deviceMac });
        if (device) {
            device.lastSeen = new Date();
            device.connectionStatus = 'online';
            await device.save();
        }
    }

    async handleStateUpdate(socket, data) {
        if (!socket.deviceMac) return;

        try {
            const device = await Device.findOne({ macAddress: socket.deviceMac });
            if (!device) return;

            // Update switch states
            if (data.switches) {
                for (const sw of data.switches) {
                    const deviceSwitch = device.switches.id(sw.gpio);
                    if (deviceSwitch) {
                        deviceSwitch.state = sw.state;
                        if (sw.manual_override !== undefined) {
                            deviceSwitch.manualOverride = sw.manual_override;
                        }
                    }
                }
                await device.save();
            }

            // Broadcast state update to connected clients
            this.io.emit('device_state_update', {
                mac: socket.deviceMac,
                states: data.switches,
                timestamp: new Date()
            });
        } catch (err) {
            logger.error('State update error:', err);
        }
    }

    async generateDeviceConfig(device) {
        return {
            deviceId: device._id,
            name: device.name,
            switches: device.switches.map(sw => ({
                id: sw._id,
                name: sw.name,
                relayGpio: sw.relayGpio,
                manualSwitchEnabled: sw.manualSwitchEnabled,
                manualSwitchGpio: sw.manualSwitchGpio
            }))
        };
    }
}

/**
 * Get device configuration for ESP32
 * GET /api/esp32/config/:macAddress
 */
exports.getDeviceConfig = async (req, res) => {
  try {
    const { macAddress } = req.params;
    
    const device = await Device.findOne({ macAddress });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Format configuration for ESP32
    const config = {
      deviceId: device._id,
      name: device.name,
      pirEnabled: device.pirEnabled,
      pirGpio: device.pirGpio,
      pirAutoOffDelay: device.pirAutoOffDelay,
      switches: device.switches.map(sw => ({
        id: sw._id,
        name: sw.name,
        relayGpio: sw.relayGpio,
        usePir: sw.usePir,
        manualSwitchEnabled: sw.manualSwitchEnabled,
        manualSwitchGpio: sw.manualSwitchGpio
      }))
    };

    res.json(config);
  } catch (error) {
    console.error('Error getting device config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update device state from ESP32
 * POST /api/esp32/state/:macAddress
 */
exports.updateDeviceStatus = async (req, res) => {
  try {
    const { macAddress } = req.params;
    const { switchId, state } = req.body;

    const device = await Device.findOne({ macAddress });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Update switch state
    const switchToUpdate = device.switches.id(switchId);
    if (!switchToUpdate) {
      return res.status(404).json({ error: 'Switch not found' });
    }

    switchToUpdate.state = state;
    device.lastSeen = new Date();
    await device.save();

    // Log activity
    await ActivityLog.create({
      deviceId: device._id,
      switchId,
      action: 'state_change',
      details: { state, source: 'esp32' }
    });

    // Emit state change via WebSocket
    req.app.get('io').emit('switchStateChanged', {
      deviceId: device._id,
      switchId,
      state
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating device state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Send command to ESP32
 * POST /api/esp32/command/:macAddress
 */
exports.sendCommand = async (req, res) => {
  try {
    const { macAddress } = req.params;
    const { switchId, state } = req.body;

    const device = await Device.findOne({ macAddress });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const switchToUpdate = device.switches.id(switchId);
    if (!switchToUpdate) {
      return res.status(404).json({ error: 'Switch not found' });
    }

    // Add command to pending queue
    device.pendingCommands.push({
      type: 'setState',
      payload: {
        switchId,
        state
      }
    });

    await device.save();

    // Log activity
    await ActivityLog.create({
      deviceId: device._id,
      switchId,
      action: 'command_sent',
      details: { state, source: 'web' }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error sending command:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

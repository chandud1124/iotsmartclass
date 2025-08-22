const Device = require('../models/Device');
const User = require('../models/User');
const { logger } = require('../middleware/logger');
const ActivityLog = require('../models/ActivityLog');
const Queue = require('better-queue');

class BulkOperations {
    // Map to track switches being processed per device
    static deviceSwitchCounters = new Map();
    
    static toggleQueue = new Queue(async function(task, cb) {
        const { deviceId } = task;
        try {
            // Initialize or get switch counter for this device
            if (!BulkOperations.deviceSwitchCounters.has(deviceId)) {
                BulkOperations.deviceSwitchCounters.set(deviceId, 0);
            }
            
            const currentCount = BulkOperations.deviceSwitchCounters.get(deviceId);
            if (currentCount >= 6) { // Max 6 switches per ESP32
                // If device is already processing 6 switches, delay this task
                setTimeout(() => {
                    BulkOperations.toggleQueue.push(task);
                }, 1000);
                return cb(null, { delayed: true });
            }

            // Increment counter for this device
            BulkOperations.deviceSwitchCounters.set(deviceId, currentCount + 1);
            
            const result = await task.execute();
            
            // Decrement counter after task completes
            if (BulkOperations.deviceSwitchCounters.has(deviceId)) {
                const newCount = Math.max(0, BulkOperations.deviceSwitchCounters.get(deviceId) - 1);
                if (newCount === 0) {
                    BulkOperations.deviceSwitchCounters.delete(deviceId);
                } else {
                    BulkOperations.deviceSwitchCounters.set(deviceId, newCount);
                }
            }
            
            cb(null, result);
        } catch (error) {
            // Ensure counter is decremented even if task fails
            if (BulkOperations.deviceSwitchCounters.has(deviceId)) {
                const count = Math.max(0, BulkOperations.deviceSwitchCounters.get(deviceId) - 1);
                if (count === 0) {
                    BulkOperations.deviceSwitchCounters.delete(deviceId);
                } else {
                    BulkOperations.deviceSwitchCounters.set(deviceId, count);
                }
            }
            cb(error);
        }
    }, { 
        maxRetries: 3,
        retryDelay: 1000,
        concurrent: 10
    });

    static async bulkCreateDevices(devices, userId) {
        const results = {
            successful: [],
            failed: [],
            total: devices.length
        };

        for (const device of devices) {
            try {
                const existing = await Device.findOne({ macAddress: device.macAddress });
                if (existing) {
                    results.failed.push({
                        device: device,
                        error: 'MAC address already exists'
                    });
                    continue;
                }

                const newDevice = new Device({
                    ...device,
                    createdBy: userId,
                    lastModifiedBy: userId
                });

                await newDevice.save();
                results.successful.push(newDevice);
            } catch (error) {
                results.failed.push({
                    device: device,
                    error: error.message
                });
            }
        }

        return results;
    }

    static async bulkCreateUsers(users, adminId) {
        const results = {
            successful: [],
            failed: [],
            total: users.length
        };

        for (const user of users) {
            try {
                const existing = await User.findOne({ email: user.email });
                if (existing) {
                    results.failed.push({
                        user: user,
                        error: 'Email already exists'
                    });
                    continue;
                }

                const newUser = new User({
                    ...user,
                    createdBy: adminId,
                    lastModifiedBy: adminId
                });

                await newUser.save();
                results.successful.push(newUser);
            } catch (error) {
                results.failed.push({
                    user: user,
                    error: error.message
                });
            }
        }

        return results;
    }

    static async bulkToggleSwitches(devices, switchId, targetState) {
        const results = {
            successful: [],
            failed: [],
            total: devices.length,
            retried: 0
        };

        // Process all devices with controlled concurrency
        const togglePromises = devices.map(deviceId => {
            return new Promise((resolve) => {
                const toggleTask = {
                    deviceId,
                    execute: async () => {
                        try {
                            const device = await Device.findById(deviceId);
                            if (!device) {
                                throw new Error('Device not found');
                            }

                            // Check if device is online and identified
                            const lastSeen = new Date(device.lastSeen);
                            const now = new Date();
                            if (now - lastSeen > 60000) { // More than 1 minute offline
                                throw new Error('Device is offline');
                            }

                            if (!device.isIdentified) {
                                throw new Error('Device not identified');
                            }

                            // Find the switch and toggle it
                            const switchObj = device.switches.find(s => s._id.toString() === switchId);
                            if (!switchObj) {
                                throw new Error('Switch not found');
                            }

                            // Update switch state
                            const newState = targetState !== undefined ? targetState : !switchObj.state;
                            switchObj.state = newState;
                            switchObj.lastToggled = new Date();
                            
                            // Save with optimistic locking
                            await device.save();

                            // Log the activity
                            await ActivityLog.create({
                                device: deviceId,
                                switch: switchId,
                                action: 'bulk_toggle',
                                status: 'success',
                                details: { newState }
                            });

                            results.successful.push({
                                deviceId,
                                switchId,
                                newState,
                                timestamp: new Date()
                            });

                            return { deviceId, switchId, newState };
                        } catch (error) {
                            // Log the failure
                            await ActivityLog.create({
                                device: deviceId,
                                switch: switchId,
                                action: 'bulk_toggle',
                                status: 'error',
                                details: { error: error.message }
                            });

                            results.failed.push({
                                deviceId,
                                switchId,
                                error: error.message
                            });

                            throw error; // Re-throw to trigger retry mechanism
                        }
                    },
                    onRetry: () => {
                        results.retried++;
                        logger.warn(`Retrying toggle for device ${deviceId}, switch ${switchId}`);
                    }
                };

                BulkOperations.toggleQueue.push(toggleTask, (err) => {
                    if (err) {
                        logger.error(`Failed to toggle device ${deviceId}, switch ${switchId}: ${err.message}`);
                    }
                    resolve();
                });
            });
        });

        // Wait for all toggle operations to complete
        await Promise.all(togglePromises);

        // Clean up any stuck counters
        for (const [deviceId, count] of BulkOperations.deviceSwitchCounters.entries()) {
            if (count > 0) {
                logger.warn(`Cleaning up stuck counter for device ${deviceId}`);
                BulkOperations.deviceSwitchCounters.delete(deviceId);
            }
        }

        return results;
    }

    static async bulkUpdateDevices(updates) {
        const results = {
            successful: [],
            failed: [],
            total: updates.length
        };

        for (const update of updates) {
            try {
                const device = await Device.findByIdAndUpdate(
                    update.id,
                    { $set: update.changes },
                    { new: true, runValidators: true }
                );

                if (!device) {
                    results.failed.push({
                        update: update,
                        error: 'Device not found'
                    });
                    continue;
                }

                results.successful.push(device);
            } catch (error) {
                results.failed.push({
                    update: update,
                    error: error.message
                });
            }
        }

        return results;
    }

    static cleanupStaleCounters() {
        for (const [deviceId, count] of BulkOperations.deviceSwitchCounters.entries()) {
            if (count > 0) {
                logger.warn(`Cleaning up stuck counter for device ${deviceId}`);
                BulkOperations.deviceSwitchCounters.delete(deviceId);
            }
        }
    }
}

// Clean up stale device counters every minute
setInterval(() => {
    BulkOperations.cleanupStaleCounters();
}, 60000);

module.exports = BulkOperations;

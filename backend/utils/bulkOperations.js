const Device = require('../models/Device');
const User = require('../models/User');
const { logger } = require('../middleware/logger');
const ActivityLog = require('../models/ActivityLog');
const Queue = require('better-queue');

class BulkOperations {
    // Configuration constants for batch processing
    static BATCH_SIZE = 4; // Maximum switches per batch
    static BATCH_DELAY = 500; // Delay between batches in milliseconds
    static DEVICE_TIMEOUT = 60000; // Device offline timeout (1 minute)
    static BATCH_TIMEOUT = 10000; // Batch command timeout (10 seconds)

    // Map to track switches being processed per device
    static deviceSwitchCounters = new Map();

    static toggleQueue = new Queue(async function (task, cb) {
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

    /**
     * Advanced batch processing for ESP32 devices with switch grouping
     * Groups switches by ESP32 device and sends commands in batches of 4
     * This optimizes performance and prevents device overload
     *
     * @param {Array} devices - Array of device IDs
     * @param {String} switchId - Switch ID to toggle
     * @param {Boolean} targetState - Target state (true=on, false=off, null=toggle)
     * @returns {Object} Results with success/failure counts and batch information
     */
    static async bulkToggleSwitches(devices, switchId, targetState, req) {
        const results = {
            successful: [],
            failed: [],
            total: devices.length,
            retried: 0,
            batches: []
        };

        // Group devices by their ESP32 device for batching
        const deviceGroups = new Map();

        for (const deviceId of devices) {
            try {
                const device = await Device.findById(deviceId);
                if (!device) continue;

                const esp32Id = device.macAddress; // Use MAC address as ESP32 identifier
                if (!deviceGroups.has(esp32Id)) {
                    deviceGroups.set(esp32Id, {
                        esp32Id,
                        devices: [],
                        switches: []
                    });
                }

                deviceGroups.get(esp32Id).devices.push(device);
                deviceGroups.get(esp32Id).switches.push({
                    deviceId,
                    switchId,
                    targetState
                });
            } catch (error) {
                results.failed.push({
                    deviceId,
                    switchId,
                    error: `Failed to load device: ${error.message}`
                });
            }
        }

        // Process each ESP32 device with batching
        const batchPromises = [];
        for (const [esp32Id, group] of deviceGroups) {
            batchPromises.push(processESP32Group(esp32Id, group));
        }

        async function processESP32Group(esp32Id, group) {
            const { devices: groupDevices, switches } = group;
            const batchSize = 4; // Send commands in batches of 4 switches
            const batches = [];

            // Split switches into batches of 4
            for (let i = 0; i < switches.length; i += batchSize) {
                batches.push(switches.slice(i, i + batchSize));
            }

            results.batches.push({
                esp32Id,
                totalBatches: batches.length,
                switchesCount: switches.length
            });

            // Process each ESP32 device with batching
            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                const batch = batches[batchIndex];
                const batchId = `${esp32Id}_batch_${batchIndex + 1}`;

                try {
                    // Check if ESP32 is online
                    const primaryDevice = groupDevices[0];
                    const lastSeen = new Date(primaryDevice.lastSeen);
                    const now = new Date();
                    if (now - lastSeen > BulkOperations.DEVICE_TIMEOUT) {
                        throw new Error('ESP32 device is offline');
                    }

                    if (!primaryDevice.isIdentified) {
                        throw new Error('ESP32 device not identified');
                    }

                    // Prepare batch command
                    const batchCommand = {
                        action: 'bulk_toggle_batch',
                        batchId,
                        switches: batch.map(switchInfo => ({
                            deviceId: switchInfo.deviceId,
                            switchId: switchInfo.switchId,
                            targetState: switchInfo.targetState !== undefined ? switchInfo.targetState : null
                        })),
                        timestamp: new Date()
                    };

                    // Send batch command to ESP32
                    logger.info(`Sending batch ${batchId} to ESP32 ${esp32Id} with ${batch.length} switches`);

                    try {
                        const esp32Service = req.app.get('esp32Service');
                        const esp32Response = await esp32Service.sendBatchCommand(esp32Id, batchCommand);

                        logger.info(`ESP32 ${esp32Id} processed batch ${batchId}: ${esp32Response.processed} switches`);

                        // Process each switch in the batch for database updates
                        for (const switchInfo of batch) {
                            try {
                                const device = groupDevices.find(d => d._id.toString() === switchInfo.deviceId);
                                if (!device) continue;

                                const switchObj = device.switches.find(s => s._id.toString() === switchInfo.switchId);
                                if (!switchObj) continue;

                                // Update switch state
                                const newState = switchInfo.targetState !== undefined ? switchInfo.targetState : !switchObj.state;
                                switchObj.state = newState;
                                switchObj.lastToggled = new Date();

                                // Save device
                                await device.save();

                                // Log success
                                await ActivityLog.create({
                                    device: switchInfo.deviceId,
                                    switch: switchInfo.switchId,
                                    action: 'bulk_toggle_batch',
                                    status: 'success',
                                    details: { newState, batchId }
                                });

                                results.successful.push({
                                    deviceId: switchInfo.deviceId,
                                    switchId: switchInfo.switchId,
                                    newState,
                                    batchId,
                                    timestamp: new Date()
                                });
                            } catch (switchError) {
                                logger.error(`Error processing switch ${switchInfo.switchId}:`, switchError);
                                results.failed.push({
                                    deviceId: switchInfo.deviceId,
                                    switchId: switchInfo.switchId,
                                    error: switchError.message,
                                    batchId
                                });
                            }
                        }
                    } catch (esp32Error) {
                        logger.error(`ESP32 ${esp32Id} batch ${batchId} failed:`, esp32Error);

                        // Mark all switches in this batch as failed
                        for (const switchInfo of batch) {
                            results.failed.push({
                                deviceId: switchInfo.deviceId,
                                switchId: switchInfo.switchId,
                                error: `ESP32 communication failed: ${esp32Error.message}`,
                                batchId
                            });
                        }
                    }

                    // Add delay between batches to prevent overwhelming ESP32
                    if (batchIndex < batches.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, BulkOperations.BATCH_DELAY));
                    }
                }

                catch (batchError) {
                    logger.error(`Batch ${batchId} failed: ${batchError.message}`);

                    // Mark all switches in this batch as failed
                    for (const switchInfo of batch) {
                        results.failed.push({
                            deviceId: switchInfo.deviceId,
                            switchId: switchInfo.switchId,
                            error: `Batch failed: ${batchError.message}`,
                            batchId
                        });
                    }
                }
            }
        }

        // Wait for all ESP32 batch operations to complete
        await Promise.all(batchPromises);

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

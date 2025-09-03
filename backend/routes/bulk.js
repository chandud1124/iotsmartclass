const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const BulkOperations = require('../utils/bulkOperations');
const { logger } = require('../middleware/logger');
const Device = require('../models/Device');

// Bulk create devices
router.post('/devices', auth, authorize('admin'), async (req, res) => {
    try {
        const results = await BulkOperations.bulkCreateDevices(req.body.devices, req.user.id);
        res.json({
            message: 'Bulk device creation completed',
            results
        });
    } catch (error) {
        logger.error('Bulk device creation failed:', error);
        res.status(500).json({
            error: 'Bulk operation failed',
            message: error.message
        });
    }
});

// Bulk toggle switches
router.post('/toggle', auth, async (req, res) => {
    try {
        const { devices, switchId, state } = req.body;
        if (!Array.isArray(devices) || !switchId) {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'devices must be an array and switchId is required'
            });
        }

        const results = await BulkOperations.bulkToggleSwitches(devices, switchId, state, req);

        // Send real-time updates through WebSocket for all affected devices
        const io = req.app.get('io');
        results.successful.forEach(result => {
            io.to(`device:${result.deviceId}`).emit('device:update', {
                type: 'switch_state',
                deviceId: result.deviceId,
                switchId: result.switchId,
                state: result.newState
            });
        });

        res.json({
            message: 'Bulk toggle operation completed',
            results
        });
    } catch (error) {
        logger.error('Bulk toggle operation failed:', error);
        res.status(500).json({
            error: 'Bulk operation failed',
            message: error.message
        });
    }
});

// Bulk update devices
router.put('/devices', auth, authorize('admin'), async (req, res) => {
    try {
        const results = await BulkOperations.bulkUpdateDevices(req.body.updates);
        res.json({
            message: 'Bulk device update completed',
            results
        });
    } catch (error) {
        logger.error('Bulk device update failed:', error);
        res.status(500).json({
            error: 'Bulk operation failed',
            message: error.message
        });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const SecurityAlert = require('../models/SecurityAlert');
const securityService = require('../services/securityService');
const { logger } = require('../middleware/logger');

// Get all security alerts with filtering
router.get('/alerts', auth, async (req, res) => {
    try {
        const query = {};
        
        if (req.query.type) query.type = req.query.type;
        if (req.query.severity) query.severity = req.query.severity;
        if (req.query.resolved === 'true') query.resolved = true;
        if (req.query.resolved === 'false') query.resolved = false;
        if (req.query.deviceId) query.deviceId = req.query.deviceId;

        const alerts = await SecurityAlert.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(req.query.limit) || 100)
            .populate('deviceId', 'name location')
            .lean();

        res.json(alerts);
    } catch (error) {
        logger.error('Error fetching security alerts:', error);
        res.status(500).json({ error: 'Failed to fetch security alerts' });
    }
});

// Get blacklisted devices
router.get('/blacklist', auth, async (req, res) => {
    try {
        const blacklistedAlerts = await SecurityAlert.find({
            type: 'blacklist',
            resolved: false
        }).populate('deviceId', 'name location');
        
        res.json(blacklistedAlerts);
    } catch (error) {
        logger.error('Error fetching blacklist:', error);
        res.status(500).json({ error: 'Failed to fetch blacklist' });
    }
});

// Resolve an alert
router.post('/alerts/:alertId/resolve', auth, async (req, res) => {
    try {
        const alert = await SecurityAlert.findById(req.params.alertId);
        if (!alert) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        alert.resolved = true;
        alert.resolvedBy = req.user._id;
        alert.resolvedAt = new Date();
        alert.resolution = req.body.resolution;

        // If this was a blacklist alert, remove from blacklist
        if (alert.type === 'blacklist' && alert.deviceId) {
            const deviceId = alert.deviceId.toString();
            if (securityService.isBlacklisted(deviceId)) {
                securityService.removeFromBlacklist(deviceId);
            }
        }

        await alert.save();
        res.json(alert);
    } catch (error) {
        logger.error('Error resolving alert:', error);
        res.status(500).json({ error: 'Failed to resolve alert' });
    }
});

// Acknowledge an alert
router.post('/alerts/:alertId/acknowledge', auth, async (req, res) => {
    try {
        const alert = await SecurityAlert.findById(req.params.alertId);
        if (!alert) {
            return res.status(404).json({ error: 'Alert not found' });
        }

        alert.acknowledged = true;
        alert.acknowledgedBy = req.user._id;
        alert.acknowledgedAt = new Date();
        
        await alert.save();
        res.json(alert);
    } catch (error) {
        logger.error('Error acknowledging alert:', error);
        res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
});

// Get security metrics
router.get('/metrics', auth, async (req, res) => {
    try {
        const timeRange = req.query.range || '24h';
        const since = new Date();
        
        switch (timeRange) {
            case '24h':
                since.setHours(since.getHours() - 24);
                break;
            case '7d':
                since.setDate(since.getDate() - 7);
                break;
            case '30d':
                since.setDate(since.getDate() - 30);
                break;
            default:
                since.setHours(since.getHours() - 24);
        }

        const metrics = await SecurityAlert.aggregate([
            {
                $match: {
                    createdAt: { $gte: since }
                }
            },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 },
                    resolved: {
                        $sum: { $cond: ['$resolved', 1, 0] }
                    },
                    unresolved: {
                        $sum: { $cond: ['$resolved', 0, 1] }
                    },
                    avgResolutionTime: {
                        $avg: {
                            $cond: [
                                '$resolved',
                                { $subtract: ['$resolvedAt', '$createdAt'] },
                                null
                            ]
                        }
                    }
                }
            }
        ]);

        res.json(metrics);
    } catch (error) {
        logger.error('Error fetching security metrics:', error);
        res.status(500).json({ error: 'Failed to fetch security metrics' });
    }
});

module.exports = router;

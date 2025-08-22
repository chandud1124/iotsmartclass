const securityService = require('../services/securityService');
const { logger } = require('./logger');

const securityMiddleware = async (req, res, next) => {
    const clientIp = req.ip;
    const deviceId = req.params.deviceId || req.body.deviceId;

    try {
        // Rate limiting by IP
        if (!await securityService.checkRateLimit(clientIp, 100, 60000)) {
            logger.warn(`Rate limit exceeded for IP ${clientIp}`);
            return res.status(429).json({ error: 'Too many requests' });
        }

        // Device blacklist check
        if (deviceId && securityService.isBlacklisted(deviceId)) {
            logger.warn(`Blocked request from blacklisted device ${deviceId}`);
            return res.status(403).json({ error: 'Device is blacklisted' });
        }

        // Request signature validation for device-specific endpoints
        if (deviceId && req.path.includes('/api/devices')) {
            if (!securityService.validateRequest(req, deviceId)) {
                securityService.trackActivity(deviceId, { type: 'auth_failure' });
                return res.status(401).json({ error: 'Invalid request signature' });
            }
        }

        next();
    } catch (error) {
        logger.error('Security middleware error:', error);
        res.status(500).json({ error: 'Security check failed' });
    }
};

module.exports = securityMiddleware;

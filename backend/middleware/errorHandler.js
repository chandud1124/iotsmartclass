const { logger } = require('./logger');

const errorTypes = {
    DEVICE_NOT_IDENTIFIED: {
        code: 'device_not_identified',
        status: 409,
        message: 'Device is not identified/connected'
    },
    DEVICE_OFFLINE: {
        code: 'device_offline',
        status: 409,
        message: 'Device is currently offline'
    },
    INVALID_STATE: {
        code: 'invalid_state',
        status: 400,
        message: 'Invalid device state'
    },
    OPERATION_TIMEOUT: {
        code: 'operation_timeout',
        status: 408,
        message: 'Operation timed out'
    }
};

const errorHandler = (err, req, res, next) => {
    // Log error details
    logger.error('Error:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        body: req.body,
        user: req.user ? { id: req.user.id, role: req.user.role } : null
    });

    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            details: Object.values(err.errors).map(e => e.message)
        });
    }

    if (err.name === 'MongoError' || err.name === 'MongoServerError') {
        if (err.code === 11000) {
            return res.status(400).json({
                error: 'Duplicate Error',
                message: 'A record with that information already exists'
            });
        }
    }

    if (err.name === 'DeviceNotIdentifiedError') {
        return res.status(409).json({
            error: 'Device Not Identified',
            code: 'device_not_identified',
            message: 'Device is not identified/connected. Please wait for the device to connect and try again.'
        });
    }

    if (err.name === 'DeviceOfflineError') {
        return res.status(409).json({
            error: 'Device Offline',
            code: 'device_offline',
            message: 'Device is currently offline. Please check the device connection.'
        });
    }

    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Invalid Token',
            message: 'Please login again'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            error: 'Token Expired',
            message: 'Please login again'
        });
    }

    // Default error
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        code: err.code || 'UNKNOWN_ERROR'
    });
};

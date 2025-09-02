// Simple console logger to replace Winston temporarily
const logger = {
    info: (message, ...args) => {
        if (process.env.NODE_ENV === 'development') {
            console.log(`[INFO] ${new Date().toISOString()} ${message}`, ...args);
        }
    },
    error: (message, ...args) => {
        console.error(`[ERROR] ${new Date().toISOString()} ${message}`, ...args);
    },
    warn: (message, ...args) => {
        console.warn(`[WARN] ${new Date().toISOString()} ${message}`, ...args);
    },
    debug: (message, ...args) => {
        if (process.env.NODE_ENV === 'development') {
            console.debug(`[DEBUG] ${new Date().toISOString()} ${message}`, ...args);
        }
    }
};

const errorLogger = (err, req, res, next) => {
    const errorDetails = {
        timestamp: new Date().toISOString(),
        error: {
            name: err.name,
            message: err.message,
            stack: err.stack
        },
        request: {
            method: req.method,
            url: req.url,
            body: req.body,
            query: req.query,
            params: req.params
        }
    };

    // Log error details
    logger.error('API Error:', errorDetails);

    // Send appropriate response
    const statusCode = err.statusCode || 500;
    const response = {
        error: true,
        message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
        code: err.code || 'INTERNAL_ERROR',
        timestamp: errorDetails.timestamp
    };

    res.status(statusCode).json(response);
};

module.exports = { errorLogger, logger };

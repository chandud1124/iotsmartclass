const { logger } = require('../middleware/logger');

class MonitoringService {
    constructor() {
        this.metrics = {
            deviceConnections: new Map(),
            switchOperations: new Map(),
            errors: new Map(),
            apiCalls: new Map()
        };
        this.alerts = new Set();
    }

    // Device Metrics
    trackDeviceConnection(deviceId, status) {
        const now = new Date();
        if (!this.metrics.deviceConnections.has(deviceId)) {
            this.metrics.deviceConnections.set(deviceId, []);
        }
        this.metrics.deviceConnections.get(deviceId).push({ status, timestamp: now });
        
        // Alert on frequent disconnections
        if (status === 'disconnected') {
            const disconnections = this.metrics.deviceConnections.get(deviceId)
                .filter(m => m.status === 'disconnected' && 
                    m.timestamp > new Date(now - 3600000)); // Last hour
            if (disconnections.length > 5) {
                this.createAlert('frequent_disconnections', deviceId);
            }
        }
    }

    trackSwitchOperation(deviceId, switchId, operation, success) {
        const key = `${deviceId}:${switchId}`;
        if (!this.metrics.switchOperations.has(key)) {
            this.metrics.switchOperations.set(key, []);
        }
        this.metrics.switchOperations.get(key).push({
            operation,
            success,
            timestamp: new Date()
        });

        // Alert on repeated failures
        if (!success) {
            const recentFailures = this.metrics.switchOperations.get(key)
                .filter(op => !op.success && 
                    op.timestamp > new Date(Date.now() - 900000)); // Last 15 minutes
            if (recentFailures.length >= 3) {
                this.createAlert('switch_failures', { deviceId, switchId });
            }
        }
    }

    trackError(type, details) {
        if (!this.metrics.errors.has(type)) {
            this.metrics.errors.set(type, []);
        }
        this.metrics.errors.get(type).push({
            details,
            timestamp: new Date()
        });

        // Alert on error spikes
        const recentErrors = this.metrics.errors.get(type)
            .filter(e => e.timestamp > new Date(Date.now() - 300000)); // Last 5 minutes
        if (recentErrors.length >= 10) {
            this.createAlert('error_spike', { type });
        }
    }

    trackApiCall(endpoint, method, statusCode) {
        const key = `${method}:${endpoint}`;
        if (!this.metrics.apiCalls.has(key)) {
            this.metrics.apiCalls.set(key, []);
        }
        this.metrics.apiCalls.get(key).push({
            statusCode,
            timestamp: new Date()
        });
    }

    // Alerts
    createAlert(type, data) {
        const alert = {
            type,
            data,
            timestamp: new Date(),
            id: Math.random().toString(36).substr(2, 9)
        };
        this.alerts.add(alert);
        logger.warn(`Alert created: ${type}`, data);
        return alert;
    }

    getActiveAlerts() {
        return Array.from(this.alerts);
    }

    dismissAlert(alertId) {
        this.alerts = new Set([...this.alerts].filter(a => a.id !== alertId));
    }

    // Metrics Retrieval
    getDeviceMetrics(deviceId, timeRange = 3600000) { // Default 1 hour
        const metrics = this.metrics.deviceConnections.get(deviceId) || [];
        return metrics.filter(m => m.timestamp > new Date(Date.now() - timeRange));
    }

    getSwitchMetrics(deviceId, switchId, timeRange = 3600000) {
        const key = `${deviceId}:${switchId}`;
        const metrics = this.metrics.switchOperations.get(key) || [];
        return metrics.filter(m => m.timestamp > new Date(Date.now() - timeRange));
    }

    getErrorMetrics(timeRange = 3600000) {
        const result = {};
        for (const [type, errors] of this.metrics.errors) {
            result[type] = errors.filter(e => e.timestamp > new Date(Date.now() - timeRange));
        }
        return result;
    }

    getApiMetrics(timeRange = 3600000) {
        const result = {};
        for (const [endpoint, calls] of this.metrics.apiCalls) {
            result[endpoint] = calls.filter(c => c.timestamp > new Date(Date.now() - timeRange));
        }
        return result;
    }

    // Cleanup old metrics (call periodically)
    cleanup(maxAge = 86400000) { // Default 24 hours
        const now = Date.now();
        const cleanupMap = (map) => {
            for (const [key, items] of map) {
                const filtered = items.filter(item => 
                    now - item.timestamp.getTime() < maxAge
                );
                if (filtered.length === 0) {
                    map.delete(key);
                } else {
                    map.set(key, filtered);
                }
            }
        };

        cleanupMap(this.metrics.deviceConnections);
        cleanupMap(this.metrics.switchOperations);
        cleanupMap(this.metrics.errors);
        cleanupMap(this.metrics.apiCalls);
    }
}

module.exports = new MonitoringService();

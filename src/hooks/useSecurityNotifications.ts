
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import socketService from '@/services/socketService';

interface SecurityAlert {
  id: string;
  deviceId: string;
  deviceName: string;
  location: string;
  message: string;
  timestamp: Date;
  type: 'timeout' | 'unauthorized_access' | 'device_offline' | 'pir_triggered' | 'user_created' | 'user_updated' | 'user_deleted' | 'device_created' | 'device_updated' | 'device_deleted' | 'system_alert';
  acknowledged: boolean;
  severity?: string;
  metadata?: Record<string, any>;
}

export const useSecurityNotifications = () => {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();

  const addAlert = (alert: Omit<SecurityAlert, 'id' | 'timestamp' | 'acknowledged'>) => {
    const newAlert: SecurityAlert = {
      ...alert,
      id: Date.now().toString(),
      timestamp: new Date(),
      acknowledged: false
    };

    setAlerts(prev => [newAlert, ...prev]);

    // Show toast notification for all users (not just security)
    const title = getNotificationTitle(alert.type);
    toast({
      title,
      description: `${alert.message}`,
      variant: alert.severity === 'high' ? "destructive" : "default",
      duration: alert.severity === 'high' ? 10000 : 5000
    });

    // Play notification sound (in real implementation)
    console.log('NOTIFICATION:', newAlert);
  };

  const getNotificationTitle = (type: string) => {
    switch (type) {
      case 'user_created': return '👤 New User Created';
      case 'user_updated': return '👤 User Updated';
      case 'user_deleted': return '👤 User Deleted';
      case 'device_created': return '📱 Device Added';
      case 'device_updated': return '📱 Device Updated';
      case 'device_deleted': return '📱 Device Removed';
      case 'pir_triggered': return '🚨 Motion Detected';
      case 'timeout': return '⏰ Device Timeout';
      case 'unauthorized_access': return '🚫 Unauthorized Access';
      case 'device_offline': return '📴 Device Offline';
      case 'system_alert': return '⚠️ System Alert';
      default: return '🔔 Notification';
    }
  };

  const acknowledgeAlert = (alertId: string) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId
          ? { ...alert, acknowledged: true }
          : alert
      )
    );
  };

  const clearAllAlerts = () => {
    setAlerts([]);
  };

  const getUnacknowledgedCount = () => {
    return alerts.filter(alert => !alert.acknowledged).length;
  };

  // Listen for various notification types
  useEffect(() => {
    if (!user) return;

    const handleNotification = (payload: any) => {
      // Handle security alerts (existing functionality)
      if (payload.type === 'security_alert' || payload.type === 'timeout' || payload.type === 'motion_override' || payload.type === 'device_offline') {
        const isAdmin = user.role === 'admin';
        const isSecurity = user.role === 'security' || user.role === 'guard';
        const adminTypes = ['motion_override', 'timeout', 'device_offline'];
        const securityTypes = ['timeout', 'motion_override'];
        const userDeviceAllowed = !user.assignedDevices?.length || user.assignedDevices.includes(String(payload.deviceId));

        if (isAdmin && adminTypes.includes(payload.type) && userDeviceAllowed) {
          addAlert({
            deviceId: payload.deviceId,
            deviceName: payload.deviceName,
            location: payload.location,
            message: payload.message,
            type: (payload.type === 'motion_override' ? 'unauthorized_access' : payload.type) as any,
            severity: 'high'
          });
        } else if (isSecurity && securityTypes.includes(payload.type) && userDeviceAllowed) {
          addAlert({
            deviceId: payload.deviceId,
            deviceName: payload.deviceName,
            location: payload.location,
            message: payload.message,
            type: 'pir_triggered',
            severity: 'high'
          });
        }
      }

      // Handle general notifications (new functionality)
      else if (payload.type === 'user_created' || payload.type === 'user_updated' || payload.type === 'user_deleted') {
        // Only admins should see user management notifications
        if (user.role === 'admin') {
          addAlert({
            deviceId: '',
            deviceName: '',
            location: '',
            message: payload.message,
            type: payload.type,
            severity: 'medium',
            metadata: payload.metadata
          });
        }
      }

      else if (payload.type === 'device_created' || payload.type === 'device_updated' || payload.type === 'device_deleted') {
        // Admins and faculty should see device management notifications
        if (user.role === 'admin' || user.role === 'faculty' || user.role === 'hod') {
          addAlert({
            deviceId: payload.deviceId || '',
            deviceName: payload.deviceName || '',
            location: payload.location || '',
            message: payload.message,
            type: payload.type,
            severity: 'medium',
            metadata: payload.metadata
          });
        }
      }

      else if (payload.type === 'system_alert') {
        // All authenticated users should see system alerts
        addAlert({
          deviceId: '',
          deviceName: '',
          location: '',
          message: payload.message,
          type: 'system_alert',
          severity: payload.severity || 'medium',
          metadata: payload.metadata
        });
      }
    };

    // Listen for multiple event types
    socketService.on('security_alert', handleNotification);
    socketService.on('user_notification', handleNotification);
    socketService.on('device_notification', handleNotification);
    socketService.on('system_notification', handleNotification);

    return () => {
      socketService.off('security_alert', handleNotification);
      socketService.off('user_notification', handleNotification);
      socketService.off('device_notification', handleNotification);
      socketService.off('system_notification', handleNotification);
    };
  }, [user]);

  return {
    alerts,
    addAlert,
    acknowledgeAlert,
    clearAllAlerts,
    getUnacknowledgedCount
  };
};

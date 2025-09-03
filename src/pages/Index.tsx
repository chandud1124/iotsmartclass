
import React, { useState, useEffect } from 'react';
import DeviceCard from '@/components/DeviceCard';
import { StatsCard } from '@/components/StatsCard';
import { MasterSwitchCard } from '@/components/MasterSwitchCard';
import { DeviceConfigDialog } from '@/components/DeviceConfigDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Cpu, Zap, Radar, Activity, Wifi, WifiOff, Search, Filter, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useDevices } from '@/hooks/useDevices';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';

const Index = () => {
  const { devices, toggleSwitch, updateDevice, deleteDevice, getStats, toggleAllSwitches } = useDevices();
  const { user } = useAuth();
  const { hasManagementAccess } = usePermissions();
  const { toast } = useToast();
  const [configDevice, setConfigDevice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isConnected, setIsConnected] = useState(true);
  const [activityFeed, setActivityFeed] = useState<Array<{
    id: string,
    message: string,
    timestamp: Date,
    type: 'success' | 'error' | 'info' | 'security' | 'admin',
    user?: string,
    userRole?: string,
    deviceId?: string,
    deviceName?: string,
    action?: string,
    ip?: string,
    details?: any
  }>>([]);

  // Smooth stats with a small debounce and memoized fallback from local devices to reduce flicker
  const [stats, setStats] = useState({
    totalDevices: 0,
    onlineDevices: 0,
    totalSwitches: 0,
    activeSwitches: 0,
    totalPirSensors: 0,
    activePirSensors: 0
  });

  useEffect(() => {
    let t: any;

    const loadStats = async () => {
      try {
        const newStats = await getStats();
        // Debounce apply to avoid tiny flickers when devices array is changing
        clearTimeout(t);
        t = setTimeout(() => {
          setStats(newStats);
          setLastUpdated(new Date());
          setIsConnected(true);
        }, 120);
      } catch (error) {
        setIsConnected(false);
        addActivity(`Failed to load stats: ${error}`, 'error');
        // Fall back to local computation
        const online = devices.filter(d => d.status === 'online');
        const totalSwitches = devices.reduce((s, d) => s + d.switches.length, 0);
        const activeSwitches = online.reduce((s, d) => s + d.switches.filter(sw => sw.state).length, 0);
        const totalPirSensors = devices.filter(d => d.pirEnabled && d.pirGpio !== undefined && d.pirGpio !== null).length;
        const activePirSensors = 0; // backend provides windowed PIR; keep 0 in fallback to avoid false positives
        setStats({
          totalDevices: devices.length,
          onlineDevices: online.length,
          totalSwitches,
          activeSwitches,
          totalPirSensors,
          activePirSensors
        });
      }
    };

    loadStats();

    return () => {
      clearTimeout(t);
    };
  }, [getStats, devices]);

  const addActivity = (
    message: string,
    type: 'success' | 'error' | 'info' | 'security' | 'admin' = 'info',
    details?: {
      deviceId?: string,
      deviceName?: string,
      action?: string,
      ip?: string,
      additionalData?: any
    }
  ) => {
    const newActivity = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      message,
      timestamp: new Date(),
      type,
      user: user?.name || 'Unknown User',
      userRole: user?.role || 'unknown',
      deviceId: details?.deviceId,
      deviceName: details?.deviceName,
      action: details?.action,
      ip: details?.ip || 'N/A',
      details: details?.additionalData
    };

    // Log to console for debugging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('[AUDIT LOG]', {
        timestamp: newActivity.timestamp.toISOString(),
        user: newActivity.user,
        role: newActivity.userRole,
        action: newActivity.action,
        device: newActivity.deviceName,
        type: newActivity.type,
        message: newActivity.message
      });
    }

    // For admin users, keep more activities in the feed
    const maxActivities = user?.role === 'admin' ? 20 : 10;
    setActivityFeed(prev => [newActivity, ...prev.slice(0, maxActivities - 1)]);

    // Send to backend for persistent storage (if user is authenticated)
    if (user && type !== 'info') {
      // This would integrate with backend activity logging
      // For now, we'll store in local state, but in production this should go to backend
    }
  };

  // Enhanced security audit logging
  const logSecurityEvent = (event: string, details: any) => {
    addActivity(
      `Security: ${event}`,
      'security',
      {
        action: 'security_event',
        additionalData: {
          eventType: event,
          ...details,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          sessionInfo: {
            userId: user?.id,
            userRole: user?.role,
            loginTime: user ? new Date().toISOString() : null
          }
        }
      }
    );
  };

  // Log dashboard access for admin users
  useEffect(() => {
    if (user?.role === 'admin') {
      logSecurityEvent('Admin Dashboard Access', {
        accessedBy: user.name,
        userRole: user.role,
        accessTime: new Date().toISOString(),
        deviceCount: devices.length,
        onlineDevices: devices.filter(d => d.status === 'online').length
      });
    }
  }, [user]);

  // Log bulk operations for security monitoring
  useEffect(() => {
    if (selectedDevices.size > 5 && user?.role !== 'admin') {
      logSecurityEvent('Large Bulk Operation Detected', {
        selectedDevices: selectedDevices.size,
        userRole: user?.role,
        potentialRisk: selectedDevices.size > 10 ? 'high' : 'medium'
      });
    }
  }, [selectedDevices.size, user]);

  // Security monitoring for suspicious activities
  useEffect(() => {
    const suspiciousPatterns = activityFeed.filter(activity =>
      activity.type === 'error' &&
      activity.timestamp > new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
    );

    if (suspiciousPatterns.length > 5 && user?.role === 'admin') {
      logSecurityEvent('High Error Rate Detected', {
        errorCount: suspiciousPatterns.length,
        timeWindow: '5 minutes',
        userRole: user.role,
        potentialIssue: 'System instability or attack attempt',
        recentErrors: suspiciousPatterns.slice(0, 3).map(err => ({
          message: err.message,
          timestamp: err.timestamp.toISOString(),
          user: err.user
        }))
      });
    }
  }, [activityFeed, user]);

  // Monitor for rapid successive operations (potential automation or attack)
  const operationTimestamps: number[] = [];
  useEffect(() => {
    const now = Date.now();
    operationTimestamps.push(now);

    // Keep only operations from last minute
    const recentOps = operationTimestamps.filter(ts => now - ts < 60000);

    if (recentOps.length > 30 && user?.role === 'admin') { // More than 30 operations per minute
      logSecurityEvent('High Operation Frequency Detected', {
        operationsPerMinute: recentOps.length,
        userRole: user.role,
        potentialIssue: 'Automated script or attack attempt',
        monitoringPeriod: '1 minute'
      });
    }

    // Clean up old timestamps
    operationTimestamps.splice(0, operationTimestamps.length - recentOps.length);
  });

  const handleToggleSwitch = async (deviceId: string, switchId: string) => {
    const device = devices.find(d => d.id === deviceId);
    const switchInfo = device?.switches.find(s => s.id === switchId);
    const newState = !switchInfo?.state;

    try {
      await toggleSwitch(deviceId, switchId);
      addActivity(
        `Switch "${switchInfo?.name || switchId}" on ${device?.name || deviceId} turned ${newState ? 'ON' : 'OFF'}`,
        'success',
        {
          deviceId,
          deviceName: device?.name,
          action: 'switch_toggle',
          additionalData: {
            switchId,
            switchName: switchInfo?.name,
            previousState: switchInfo?.state,
            newState,
            deviceLocation: device?.location,
            classroom: device?.classroom
          }
        }
      );
      toast({
        title: "Switch Toggled",
        description: `Switch turned ${newState ? 'ON' : 'OFF'} successfully`
      });
    } catch (error: any) {
      addActivity(
        `Failed to toggle switch "${switchInfo?.name || switchId}" on ${device?.name || deviceId}`,
        'error',
        {
          deviceId,
          deviceName: device?.name,
          action: 'switch_toggle_failed',
          additionalData: {
            switchId,
            switchName: switchInfo?.name,
            attemptedState: newState,
            error: error.message,
            deviceLocation: device?.location
          }
        }
      );
      toast({
        title: "Error",
        description: "Failed to toggle switch",
        variant: "destructive"
      });
    }
  };

  const handleUpdateDevice = async (deviceId: string, updates: any) => {
    const device = devices.find(d => d.id === deviceId);
    try {
      await updateDevice(deviceId, updates);
      addActivity(
        `Device "${device?.name || deviceId}" configuration updated`,
        'admin',
        {
          deviceId,
          deviceName: device?.name,
          action: 'device_update',
          additionalData: {
            updates: Object.keys(updates),
            deviceLocation: device?.location,
            classroom: device?.classroom,
            previousConfig: {
              name: device?.name,
              location: device?.location
            }
          }
        }
      );
      toast({
        title: "Device Updated",
        description: "Device configuration saved successfully"
      });
    } catch (error: any) {
      addActivity(
        `Failed to update device "${device?.name || deviceId}"`,
        'error',
        {
          deviceId,
          deviceName: device?.name,
          action: 'device_update_failed',
          additionalData: {
            attemptedUpdates: Object.keys(updates),
            error: error.message
          }
        }
      );
      toast({
        title: "Error",
        description: "Failed to update device",
        variant: "destructive"
      });
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);

    // Security audit for device deletion
    logSecurityEvent('Device Deletion Attempt', {
      deviceId,
      deviceName: device?.name,
      deviceLocation: device?.location,
      classroom: device?.classroom,
      macAddress: device?.macAddress,
      switchCount: device?.switches?.length || 0,
      userRole: user?.role,
      deletionReason: 'User initiated',
      riskLevel: 'high'
    });

    try {
      await deleteDevice(deviceId);
      addActivity(
        `Device "${device?.name || deviceId}" removed from system`,
        'security',
        {
          deviceId,
          deviceName: device?.name,
          action: 'device_delete',
          additionalData: {
            deviceLocation: device?.location,
            classroom: device?.classroom,
            macAddress: device?.macAddress,
            switchCount: device?.switches?.length || 0,
            reason: 'User initiated deletion'
          }
        }
      );
      toast({
        title: "Device Deleted",
        description: "Device removed successfully"
      });
    } catch (error: any) {
      addActivity(
        `Failed to delete device "${device?.name || deviceId}"`,
        'error',
        {
          deviceId,
          deviceName: device?.name,
          action: 'device_delete_failed',
          additionalData: {
            error: error.message,
            deviceLocation: device?.location
          }
        }
      );
      toast({
        title: "Error",
        description: "Failed to delete device",
        variant: "destructive"
      });
    }
  };

  const handleMasterToggle = async (state: boolean) => {
    const onlineDevices = devices.filter(d => d.status === 'online');
    const totalSwitches = onlineDevices.reduce((sum, d) => sum + d.switches.length, 0);

    try {
      await toggleAllSwitches(state);
      addActivity(
        `Master control: All switches turned ${state ? 'ON' : 'OFF'}`,
        'admin',
        {
          action: 'master_toggle',
          additionalData: {
            targetState: state,
            affectedDevices: onlineDevices.length,
            totalSwitches: totalSwitches,
            deviceList: onlineDevices.map(d => ({ id: d.id, name: d.name, switches: d.switches.length })),
            reason: 'Bulk master control operation'
          }
        }
      );
      toast({
        title: state ? "All Switches On" : "All Switches Off",
        description: `All ${totalSwitches} switches on ${onlineDevices.length} devices turned ${state ? 'on' : 'off'}`
      });
    } catch (error: any) {
      addActivity(
        `Failed to execute master control: ${error.message}`,
        'error',
        {
          action: 'master_toggle_failed',
          additionalData: {
            attemptedState: state,
            affectedDevices: onlineDevices.length,
            totalSwitches: totalSwitches,
            error: error.message
          }
        }
      );
      toast({
        title: "Error",
        description: "Failed to toggle master switch",
        variant: "destructive"
      });
    }
  };

  // Filter and search devices
  const filteredDevices = devices.filter(device => {
    const matchesSearch = device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || device.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Bulk operations
  const handleSelectDevice = (deviceId: string) => {
    setSelectedDevices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(deviceId)) {
        newSet.delete(deviceId);
      } else {
        newSet.add(deviceId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedDevices.size === filteredDevices.length) {
      setSelectedDevices(new Set());
    } else {
      setSelectedDevices(new Set(filteredDevices.map(d => d.id)));
    }
  };

  const handleBulkToggle = async (state: boolean) => {
    const selectedDeviceList = filteredDevices.filter(d => selectedDevices.has(d.id));
    const totalSwitches = selectedDeviceList.reduce((sum, d) => sum + d.switches.length, 0);

    // Security audit for large bulk operations
    if (selectedDeviceList.length > 10 || totalSwitches > 20) {
      logSecurityEvent('Large Scale Bulk Operation', {
        operationType: 'bulk_toggle',
        targetState: state,
        affectedDevices: selectedDeviceList.length,
        totalSwitches: totalSwitches,
        userRole: user?.role,
        riskLevel: selectedDeviceList.length > 20 ? 'critical' : 'high',
        deviceLocations: selectedDeviceList.map(d => d.location).filter(Boolean)
      });
    }

    try {
      for (const device of selectedDeviceList) {
        for (const switchItem of device.switches) {
          await toggleSwitch(device.id, switchItem.id);
        }
      }
      addActivity(
        `Bulk operation: ${selectedDeviceList.length} devices turned ${state ? 'ON' : 'OFF'}`,
        'admin',
        {
          action: 'bulk_toggle',
          additionalData: {
            targetState: state,
            affectedDevices: selectedDeviceList.length,
            totalSwitches: totalSwitches,
            deviceList: selectedDeviceList.map(d => ({
              id: d.id,
              name: d.name,
              location: d.location,
              classroom: d.classroom,
              switches: d.switches.length
            })),
            selectionCriteria: {
              searchTerm: searchTerm || 'none',
              statusFilter: statusFilter
            }
          }
        }
      );
      setSelectedDevices(new Set());
      toast({
        title: "Bulk Operation Complete",
        description: `${selectedDeviceList.length} devices (${totalSwitches} switches) updated successfully`
      });
    } catch (error: any) {
      addActivity(
        `Bulk operation failed: ${error.message}`,
        'error',
        {
          action: 'bulk_toggle_failed',
          additionalData: {
            attemptedState: state,
            affectedDevices: selectedDeviceList.length,
            totalSwitches: totalSwitches,
            error: error.message,
            deviceList: selectedDeviceList.map(d => ({ id: d.id, name: d.name }))
          }
        }
      );
      toast({
        title: "Bulk Operation Failed",
        description: "Some devices may not have been updated",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Devices"
          value={stats.totalDevices}
          subtitle={`${stats.onlineDevices} online`}
          icon={<Cpu className="h-4 w-4" />}
          trend={stats.onlineDevices > 0 ? 'up' : undefined}
        />
        {(() => {
          const onlineActive = stats.activeSwitches;
          const offlineActive = devices.filter(d => d.status !== 'online')
            .reduce((sum, d) => sum + d.switches.filter(sw => sw.state).length, 0);
          return (
            <StatsCard
              title="Active Switches"
              value={onlineActive}
              subtitle={`online: ${onlineActive} / total: ${stats.totalSwitches}${offlineActive ? ` (+${offlineActive} offline last-known on)` : ''}`}
              icon={<Zap className="h-4 w-4" />}
              trend={onlineActive > 0 ? 'up' : undefined}
            />
          );
        })()}
        <StatsCard
          title="PIR Sensors"
          value={stats.totalPirSensors}
          subtitle={`${stats.activePirSensors} active`}
          icon={<Radar className="h-4 w-4" />}
        />
        <StatsCard
          title="System Status"
          value={isConnected ? "Online" : "Offline"}
          subtitle={isConnected ? "All systems operational" : "Connection issues detected"}
          icon={<Activity className="h-4 w-4" />}
          trend={isConnected ? "up" : undefined}
        />
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between pl-2">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search devices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'online' | 'offline')}
              className="px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Devices</option>
              <option value="online">Online Only</option>
              <option value="offline">Offline Only</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedDevices.size > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">
              {selectedDevices.size} selected
            </span>
            <Button size="sm" onClick={() => handleBulkToggle(true)} className="bg-emerald-600 hover:bg-emerald-700">
              Turn ON
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkToggle(false)}>
              Turn OFF
            </Button>
          </div>
        )}
      </div>

      {/* Master Switch */}
      <div className="pl-2">
        <MasterSwitchCard
          totalSwitches={stats.totalSwitches}
          activeSwitches={stats.activeSwitches}
          offlineDevices={devices.filter(d => d.status !== 'online').length}
          onMasterToggle={handleMasterToggle}
          isBusy={false}
        />
      </div>

      {/* Devices */}
      <div className="space-y-4 pl-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">
            Connected Devices ({filteredDevices.length})
          </h2>
          {filteredDevices.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              {selectedDevices.size === filteredDevices.length ? 'Deselect All' : 'Select All'}
            </Button>
          )}
        </div>

        {filteredDevices.length === 0 ? (
          <div className="text-center py-12">
            <Cpu className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {devices.length === 0 ? 'No devices connected' : 'No devices match your filters'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {devices.length === 0
                ? 'Connect your ESP32 devices to get started'
                : 'Try adjusting your search or filter criteria'
              }
            </p>
            {devices.length > 0 && (
              <Button variant="outline" onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}>
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredDevices.map((device) => (
              <div key={device.id} className="relative group">
                {/* Selection Indicator */}
                {selectedDevices.has(device.id) && (
                  <div className="absolute -top-2 -right-2 z-10 animate-in fade-in duration-200">
                    <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                      <CheckCircle className="w-4 h-4 text-primary-foreground" />
                    </div>
                  </div>
                )}

                {/* Status Badge */}
                <div className="absolute top-3 left-3 z-10">
                  <Badge
                    variant={device.status === 'online' ? 'secondary' : 'destructive'}
                    className={`text-xs ${device.status === 'online'
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                      : 'bg-red-100 text-red-700 border-red-200'
                      }`}
                  >
                    {device.status === 'online' ? (
                      <>
                        <div className="w-2 h-2 bg-emerald-500 rounded-full mr-1 animate-pulse" />
                        Online
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Offline
                      </>
                    )}
                  </Badge>
                </div>

                {/* Device Card with Enhanced Interactions */}
                <div
                  className={`cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-xl ${selectedDevices.has(device.id)
                    ? 'ring-2 ring-primary ring-offset-2 shadow-lg'
                    : 'hover:ring-1 hover:ring-primary/50'
                    }`}
                  onClick={() => handleSelectDevice(device.id)}
                >
                  <DeviceCard
                    device={device}
                    onToggleSwitch={handleToggleSwitch}
                    showSwitches={false}
                    showActions={false}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Device Configuration Dialog */}
      {configDevice && (
        <DeviceConfigDialog
          initialData={devices.find(d => d.id === configDevice)!}
          open={!!configDevice}
          onOpenChange={(open) => !open && setConfigDevice(null)}
          onSubmit={(config) => {
            // Map switches preserving id/state
            const deviceRef = devices.find(d => d.id === configDevice);
            const merged = {
              ...config,
              switches: config.switches.map(sw => {
                const existing = deviceRef?.switches.find(s => s.id === (sw as any).id) || deviceRef?.switches.find(s => s.name === sw.name);
                return {
                  id: (sw as any).id || existing?.id || `switch-${Date.now()}-${Math.random()}`,
                  name: sw.name || existing?.name || 'Unnamed Switch',
                  type: sw.type || existing?.type || 'relay',
                  relayGpio: (sw as any).relayGpio || (sw as any).gpio || existing?.relayGpio || 0,
                  state: (sw as any).state !== undefined ? (sw as any).state : (existing?.state ?? false),
                  manualSwitchEnabled: sw.manualSwitchEnabled ?? existing?.manualSwitchEnabled ?? false,
                  manualSwitchGpio: sw.manualSwitchGpio !== undefined ? sw.manualSwitchGpio : existing?.manualSwitchGpio,
                  usePir: existing?.usePir || false,
                  dontAutoOff: existing?.dontAutoOff || false,
                  manualMode: (sw as any).manualMode || existing?.manualMode || 'maintained',
                  manualActiveLow: (sw as any).manualActiveLow !== undefined ? (sw as any).manualActiveLow : (existing?.manualActiveLow ?? true)
                };
              })
            };
            handleUpdateDevice(configDevice, merged);
            setConfigDevice(null);
          }}
        />
      )}
    </div>
  );
};

export default Index;

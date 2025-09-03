import React, { useState, useEffect, useMemo } from 'react';
import DeviceCard from '@/components/DeviceCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Search,
  Filter,
  Grid3X3,
  List,
  CheckSquare,
  Square,
  Wifi,
  WifiOff,
  AlertTriangle,
  RefreshCw,
  Settings,
  Trash2,
  Power,
  PowerOff
} from 'lucide-react';
import { useDevices } from '@/hooks/useDevices';
import { useToast } from '@/hooks/use-toast';
import { DeviceConfigDialog } from '@/components/DeviceConfigDialog';
import DeleteDeviceDialog from '@/components/DeleteDeviceDialog';
import { Device } from '@/types';
import { useAuth } from '@/hooks/useAuth';

type ViewMode = 'grid' | 'list' | 'compact';
type FilterStatus = 'all' | 'online' | 'offline' | 'warning';
type GroupBy = 'none' | 'classroom' | 'location' | 'status';

const Devices = () => {
  // Existing state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingDeviceId, setDeletingDeviceId] = useState<string | null>(null);
  const { devices, toggleSwitch, updateDevice, deleteDevice, addDevice } = useDevices();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { toast } = useToast();
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | undefined>(undefined);

  // New state for improvements
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Filtered and grouped devices
  const filteredAndGroupedDevices = useMemo(() => {
    if (!devices) return { groups: [], totalCount: 0 };

    // Filter devices
    let filtered = devices.filter(device => {
      // Search filter
      const matchesSearch = searchQuery === '' ||
        device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        device.macAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
        device.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        device.classroom?.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'online' && device.status === 'online') ||
        (statusFilter === 'offline' && device.status === 'offline') ||
        (statusFilter === 'warning' && device.status === 'offline'); // Could be enhanced with more warning conditions

      return matchesSearch && matchesStatus;
    });

    // Group devices
    const groups: { key: string; label: string; devices: Device[]; count: number }[] = [];

    if (groupBy === 'none') {
      groups.push({
        key: 'all',
        label: 'All Devices',
        devices: filtered,
        count: filtered.length
      });
    } else if (groupBy === 'status') {
      const statusGroups = {
        online: filtered.filter(d => d.status === 'online'),
        offline: filtered.filter(d => d.status === 'offline')
      };

      Object.entries(statusGroups).forEach(([status, devices]) => {
        if (devices.length > 0) {
          groups.push({
            key: status,
            label: `${status.charAt(0).toUpperCase() + status.slice(1)} Devices`,
            devices,
            count: devices.length
          });
        }
      });
    } else if (groupBy === 'classroom') {
      const classroomMap = new Map<string, Device[]>();
      filtered.forEach(device => {
        const key = device.classroom || 'No Classroom';
        if (!classroomMap.has(key)) {
          classroomMap.set(key, []);
        }
        classroomMap.get(key)!.push(device);
      });

      classroomMap.forEach((devices, classroom) => {
        groups.push({
          key: classroom,
          label: classroom,
          devices,
          count: devices.length
        });
      });
    } else if (groupBy === 'location') {
      const locationMap = new Map<string, Device[]>();
      filtered.forEach(device => {
        const key = device.location || 'No Location';
        if (!locationMap.has(key)) {
          locationMap.set(key, []);
        }
        locationMap.get(key)!.push(device);
      });

      locationMap.forEach((devices, location) => {
        groups.push({
          key: location,
          label: location,
          devices,
          count: devices.length
        });
      });
    }

    return { groups, totalCount: filtered.length };
  }, [devices, searchQuery, statusFilter, groupBy]);

  // Bulk operations handlers
  const handleSelectDevice = (deviceId: string, selected: boolean) => {
    const newSelected = new Set(selectedDevices);
    if (selected) {
      newSelected.add(deviceId);
    } else {
      newSelected.delete(deviceId);
    }
    setSelectedDevices(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      const allDeviceIds = new Set(
        filteredAndGroupedDevices.groups.flatMap(group => group.devices.map(d => d.id))
      );
      setSelectedDevices(allDeviceIds);
    } else {
      setSelectedDevices(new Set());
    }
    setShowBulkActions(selected);
  };

  const handleBulkToggle = async (targetState: boolean) => {
    const selectedArray = Array.from(selectedDevices);
    try {
      // For bulk operations, we'll toggle all switches on selected devices
      for (const deviceId of selectedArray) {
        const device = devices?.find(d => d.id === deviceId);
        if (device) {
          for (const switchItem of device.switches) {
            if (switchItem.state !== targetState) {
              await toggleSwitch(deviceId, switchItem.id);
            }
          }
        }
      }

      toast({
        title: "Success",
        description: `Bulk operation completed for ${selectedArray.length} devices`
      });

      setSelectedDevices(new Set());
      setShowBulkActions(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Bulk operation failed",
        variant: "destructive"
      });
    }
  };

  const handleBulkDelete = async () => {
    const selectedArray = Array.from(selectedDevices);
    try {
      for (const deviceId of selectedArray) {
        await deleteDevice(deviceId);
      }

      toast({
        title: "Success",
        description: `Deleted ${selectedArray.length} devices`
      });

      setSelectedDevices(new Set());
      setShowBulkActions(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Bulk delete failed",
        variant: "destructive"
      });
    }
  };

  const handleToggleSwitch = async (deviceId: string, switchId: string) => {
    try {
      await toggleSwitch(deviceId, switchId);
      toast({
        title: "Success",
        description: "Switch toggled successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to toggle switch",
        variant: "destructive"
      });
    }
  };

  const handleUpdateDevice = async (deviceId: string, data: Partial<Device>) => {
    try {
      await updateDevice(deviceId, data);
      toast({
        title: "Success",
        description: "Device updated successfully"
      });
      setShowConfigDialog(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update device",
        variant: "destructive"
      });
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    setDeletingDeviceId(deviceId);
    setShowDeleteDialog(true);
  };

  const confirmDeleteDevice = async () => {
    if (!deletingDeviceId) return;
    try {
      await deleteDevice(deletingDeviceId);
      toast({
        title: "Success",
        description: "Device deleted successfully"
      });
      setShowDeleteDialog(false);
      setDeletingDeviceId(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete device",
        variant: "destructive"
      });
    }
  };

  const handleAddDevice = async (deviceData: Device) => {
    try {
      await addDevice(deviceData);
      toast({
        title: "Success",
        description: "Device added successfully"
      });
      setShowConfigDialog(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add device",
        variant: "destructive"
      });
    }
  };

  if (!devices) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading devices...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <DeleteDeviceDialog
        open={showDeleteDialog}
        onOpenChange={(open) => { setShowDeleteDialog(open); if (!open) setDeletingDeviceId(null); }}
        onConfirm={confirmDeleteDevice}
        loading={false}
        deviceName={devices.find(d => d.id === deletingDeviceId)?.name || ''}
      />

      <div className="container mx-auto py-6 px-4 sm:px-6">
        {/* Header with Connection Status */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Devices</h1>
            <div className="flex items-center gap-2">
              {connectionStatus === 'connected' && <Wifi className="w-4 h-4 text-green-500" />}
              {connectionStatus === 'connecting' && <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />}
              {connectionStatus === 'disconnected' && <WifiOff className="w-4 h-4 text-red-500" />}
              <Badge
                variant={connectionStatus === 'connected' ? 'default' : 'secondary'}
                className={`text-xs ${connectionStatus === 'connected'
                    ? 'bg-green-500/10 text-green-700'
                    : connectionStatus === 'connecting'
                      ? 'bg-yellow-500/10 text-yellow-700'
                      : 'bg-red-500/10 text-red-700'
                  }`}
              >
                {connectionStatus === 'connected' ? 'Live' :
                  connectionStatus === 'connecting' ? 'Connecting...' : 'Offline'}
              </Badge>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search devices by name, MAC, location, or classroom..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={(value: FilterStatus) => setStatusFilter(value)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="warning">Warnings</SelectItem>
              </SelectContent>
            </Select>

            <Select value={groupBy} onValueChange={(value: GroupBy) => setGroupBy(value)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Group by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Grouping</SelectItem>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="classroom">Classroom</SelectItem>
                <SelectItem value="location">Location</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode Toggle */}
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-r-none"
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-none"
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'compact' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('compact')}
                className="rounded-l-none"
              >
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {showBulkActions && (
          <div className="bg-muted/50 border rounded-lg p-4 mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5" />
                <span className="font-medium">
                  {selectedDevices.size} device{selectedDevices.size !== 1 ? 's' : ''} selected
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkToggle(true)}
                  className="flex items-center gap-2"
                >
                  <Power className="w-4 h-4" />
                  Turn All On
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkToggle(false)}
                  className="flex items-center gap-2"
                >
                  <PowerOff className="w-4 h-4" />
                  Turn All Off
                </Button>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleBulkDelete}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Selected
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedDevices(new Set());
                    setShowBulkActions(false);
                  }}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Device Groups */}
        <div className="space-y-8">
          {filteredAndGroupedDevices.groups.map((group) => (
            <div key={group.key}>
              {groupBy !== 'none' && (
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    {group.label}
                    <Badge variant="secondary">{group.count}</Badge>
                  </h2>
                  {groupBy !== 'none' && (
                    <Checkbox
                      checked={group.devices.every(d => selectedDevices.has(d.id))}
                      onCheckedChange={(checked) => {
                        group.devices.forEach(device => {
                          handleSelectDevice(device.id, checked as boolean);
                        });
                      }}
                      className="mr-2"
                    />
                  )}
                </div>
              )}

              {/* Device Grid/List */}
              <div className={
                viewMode === 'grid'
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                  : viewMode === 'list'
                    ? "space-y-4"
                    : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3"
              }>
                {group.devices.map((device) => (
                  <div key={device.id} className="relative">
                    {showBulkActions && (
                      <div className="absolute -top-2 -left-2 z-10">
                        <Checkbox
                          checked={selectedDevices.has(device.id)}
                          onCheckedChange={(checked) => handleSelectDevice(device.id, checked as boolean)}
                          className="bg-background border-2"
                        />
                      </div>
                    )}

                    <DeviceCard
                      device={device}
                      onToggleSwitch={handleToggleSwitch}
                      onEditDevice={isAdmin ? (d) => { setSelectedDevice(d); setShowConfigDialog(true); } : undefined}
                      onDeleteDevice={isAdmin ? handleDeleteDevice : undefined}
                      showSwitches={viewMode !== 'compact'}
                      showActions={viewMode !== 'compact'}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredAndGroupedDevices.totalCount === 0 && (
          <div className="text-center py-12">
            <div className="text-muted-foreground mb-4">
              {searchQuery || statusFilter !== 'all' ? (
                <>
                  <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No devices match your current filters.</p>
                  <p className="text-sm">Try adjusting your search or filter criteria.</p>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No devices found.</p>
                  <p className="text-sm">Get started by adding your first device.</p>
                </>
              )}
            </div>
            {(searchQuery || statusFilter !== 'all') && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                }}
                className="mt-4"
              >
                Clear Filters
              </Button>
            )}
          </div>
        )}

        {/* Results Summary */}
        {filteredAndGroupedDevices.totalCount > 0 && (
          <div className="text-center text-sm text-muted-foreground mt-8">
            Showing {filteredAndGroupedDevices.totalCount} of {devices.length} devices
          </div>
        )}
      </div>

      {/* Fixed Add Device Button for Admins */}
      {isAdmin && !(showConfigDialog && !selectedDevice) && !selectedDevice && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            size="lg"
            variant="default"
            onClick={() => {
              setSelectedDevice(undefined);
              setShowConfigDialog(true);
            }}
            className="shadow-lg hover:shadow-xl transition-shadow"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Device
          </Button>
        </div>
      )}

      {isAdmin && (
        <DeviceConfigDialog
          open={showConfigDialog}
          onOpenChange={setShowConfigDialog}
          onSubmit={(data) => {
            if (selectedDevice) {
              handleUpdateDevice(selectedDevice.id, {
                ...data,
                switches: data.switches.map(sw => {
                  const existing = selectedDevice.switches.find(s => s.id === (sw as any).id) || selectedDevice.switches.find(s => s.name === sw.name);
                  return {
                    id: (sw as any).id || existing?.id || `switch-${Date.now()}-${Math.random()}`,
                    name: sw.name || existing?.name || 'Unnamed Switch',
                    type: sw.type || existing?.type || 'relay',
                    gpio: (sw as any).gpio ?? (sw as any).relayGpio ?? existing?.gpio ?? existing?.relayGpio ?? 0,
                    relayGpio: (sw as any).relayGpio ?? (sw as any).gpio ?? existing?.relayGpio ?? existing?.gpio ?? 0,
                    state: (sw as any).state !== undefined ? (sw as any).state : (existing?.state ?? false),
                    manualSwitchEnabled: sw.manualSwitchEnabled ?? existing?.manualSwitchEnabled ?? false,
                    manualSwitchGpio: sw.manualSwitchGpio !== undefined ? sw.manualSwitchGpio : existing?.manualSwitchGpio,
                    usePir: existing?.usePir || false,
                    dontAutoOff: existing?.dontAutoOff || false,
                    manualMode: (sw as any).manualMode || existing?.manualMode || 'maintained',
                    manualActiveLow: (sw as any).manualActiveLow !== undefined ? (sw as any).manualActiveLow : (existing?.manualActiveLow ?? true)
                  };
                })
              });
            } else {
              handleAddDevice({
                ...data,
                id: `device-${Date.now()}`,
                status: 'offline',
                lastSeen: new Date(),
                switches: data.switches.map((sw, idx) => ({
                  id: `switch-${Date.now()}-${idx}`,
                  name: sw.name || 'Unnamed Switch',
                  type: sw.type || 'relay',
                  gpio: (sw as any).gpio ?? (sw as any).relayGpio ?? 0,
                  relayGpio: (sw as any).relayGpio ?? (sw as any).gpio ?? 0,
                  state: false,
                  manualSwitchEnabled: sw.manualSwitchEnabled || false,
                  manualSwitchGpio: sw.manualSwitchGpio,
                  usePir: false,
                  dontAutoOff: false,
                }))
              } as Device);
            }
          }}
          initialData={selectedDevice}
        />
      )}
    </>
  );
};

export default Devices;

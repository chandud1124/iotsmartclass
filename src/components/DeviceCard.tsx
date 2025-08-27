import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Cpu, 
  Wifi, 
  WifiOff, 
  Settings, 
  Trash2
} from 'lucide-react';
import { SwitchControl } from './SwitchControl';
import { Device } from '@/types';



interface DeviceCardProps {
  device: Device;
  onToggleSwitch: (deviceId: string, switchId: string) => void;
  onEditDevice?: (device: Device) => void; // request opening shared edit dialog
  onDeleteDevice?: (deviceId: string) => void;
  showSwitches?: boolean;
  showActions?: boolean;
}

export default function DeviceCard({ device, onToggleSwitch, onEditDevice, onDeleteDevice, showSwitches = true, showActions = true }: DeviceCardProps) {
  // In dashboard (showActions === false), highlight card green if any switch is on
  const anySwitchOn = Array.isArray(device.switches) && device.switches.some(sw => sw.state);
  // More prominent green for online devices with any switch on, and clear difference for offline
  const isOnline = device.status === 'online';
  const dashboardHighlight = !showActions && isOnline && anySwitchOn;
  const dashboardOffline = !showActions && !isOnline;

  return (
    <Card
      style={{
        minWidth: '250px',
        maxWidth: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        padding: '0.75rem',
        boxSizing: 'border-box',
        overflow: 'hidden',
        backgroundColor: dashboardHighlight
          ? '#22c55e' // Tailwind green-500 for strong highlight
          : dashboardOffline
            ? '#b91c1c' // Tailwind red-700 for offline (darker)
            : undefined,
        color: dashboardOffline ? '#fff' : undefined,
        fontWeight: dashboardOffline ? 'bold' : undefined
      }}
      className={`shadow-md hover:shadow-lg transition-shadow duration-200 sm:max-w-xs sm:p-2 sm:overflow-hidden${dashboardHighlight ? ' ring-4 ring-green-600' : ''}${dashboardOffline ? ' opacity-70 grayscale' : ''}`}
    >
      <CardHeader className="flex flex-col gap-2 pb-2 px-2">
        <div className="w-full flex flex-col gap-1 items-center text-center">
          <CardTitle className="text-lg font-semibold leading-tight truncate mb-1 flex flex-col items-center justify-center" style={{maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
            <span>
              {device.name}
              {device.classroom && !device.name.includes(device.classroom) && ` (${device.classroom})`}
            </span>
          </CardTitle>
          <div className="flex flex-col items-center gap-1 w-full">
            <div className="text-xs text-muted-foreground truncate w-full" style={{maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
              {device.classroom ? `Classroom: ${device.classroom}` : `Location: ${device.location}`}
            </div>
            <Badge variant={device.status === 'online' ? 'default' : 'secondary'} className={device.status === 'online' ? 'bg-green-500/10 text-green-700 border-green-500/50' : 'bg-destructive/10 text-destructive border-destructive/50'} style={{maxWidth: '80px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
              {device.status.charAt(0).toUpperCase() + device.status.slice(1)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      {/* ...existing code... */}
  {/* ...existing code... */}
      <CardContent>
  <div className="grid gap-4 w-full p-0" style={{overflow: 'hidden'}}>
          {/* Device Details */}
          <div className="flex flex-col gap-1 text-xs text-muted-foreground bg-muted/50 rounded p-2 w-full">
            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-center gap-2 w-full overflow-hidden">
                <span className="font-medium text-primary min-w-[60px]">MAC:</span>
                <span className="truncate max-w-[140px]">{device.macAddress}</span>
              </div>
              <div className="flex items-center gap-2 w-full overflow-hidden">
                <span className="font-medium min-w-[60px]">Location:</span>
                <span className="truncate max-w-[140px]">{device.location}</span>
              </div>
              {device.classroom && (
                <div className="flex items-center gap-2 w-full overflow-hidden">
                  <span className="font-medium min-w-[60px]">Classroom:</span>
                  <span className="truncate max-w-[140px]">{device.classroom}</span>
                </div>
              )}
              <div className="flex items-center gap-2 w-full overflow-hidden">
                <span className="font-medium min-w-[60px]">Last seen:</span>
                <span className="truncate max-w-[140px]">{new Date(device.lastSeen).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Switches Table (conditionally rendered) */}
          {showSwitches && (
            <div className="mt-4">
              <div className="font-semibold text-sm mb-1 px-0">Switches ({device.switches.length})</div>
              {device.switches.length === 0 ? (
                <div className="text-xs text-muted-foreground px-0">No switches configured</div>
              ) : (
                <div className="overflow-x-auto px-0">
                  <table className="w-full text-xs border-collapse" style={{tableLayout: 'fixed'}}>
                    <colgroup>
                      <col span={1} style={{width: '22%'}} />
                      <col span={1} style={{width: '14%'}} />
                      <col span={1} style={{width: '18%'}} />
                      <col span={1} style={{width: '18%'}} />
                      <col span={1} style={{width: '28%'}} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="text-left font-medium p-1">Name</th>
                        <th className="text-left font-medium p-1">GPIO</th>
                        <th className="text-left font-medium p-1">Type</th>
                        <th className="text-left font-medium p-1">Manual</th>
                        <th className="text-left font-medium p-1">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {device.switches.map((sw, i) => {
                        const isOn = sw.state;
                        return (
                          <tr
                            key={sw.id || (sw as any)._id || `${sw.name}-${(sw as any).gpio || (sw as any).relayGpio || i}`}
                            className={
                              `${device.status !== 'online' ? 'opacity-60' : ''} ${isOn ? 'bg-green-100 text-green-900' : ''}`
                            }
                          >
                            <td className={`truncate px-2 py-1 min-w-[70px] max-w-[120px] ${isOn ? 'font-semibold' : ''}`}>{sw.name}</td>
                            <td className={`truncate px-2 py-1 min-w-[40px] max-w-[60px] ${isOn ? 'font-semibold' : ''}`}>{sw.gpio ?? sw.relayGpio}</td>
                            <td className={`truncate px-2 py-1 min-w-[60px] max-w-[100px] ${isOn ? 'font-semibold' : ''}`}>{sw.type}</td>
                            <td className={`truncate px-2 py-1 min-w-[40px] max-w-[60px] ${isOn ? 'font-semibold' : ''}`}>{sw.manualSwitchEnabled ? 'Yes' : 'No'}</td>
                            <td className="px-2 py-1">
                              <Button
                                size="sm"
                                variant={isOn ? 'default' : 'outline'}
                                onClick={() => {
                                  const sid = sw.id || (sw as any)._id;
                                  if (sid) onToggleSwitch(device.id, sid);
                                  else console.warn('Switch missing id when toggling', sw);
                                }}
                                disabled={device.status !== 'online'}
                                title={isOn ? 'Turn Off' : 'Turn On'}
                              >
                                {isOn ? 'On' : 'Off'}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* PIR Sensor Info */}
          {device.pirEnabled && (
            <div className="mt-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">PIR Sensor</span>
                <Badge variant="outline" className={device.pirEnabled ? 'bg-green-500/10' : 'bg-muted'}>
                  {device.pirEnabled ? 'Active' : 'Disabled'}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {device.pirGpio && `GPIO ${device.pirGpio} • `}
                Auto-off delay: {device.pirAutoOffDelay || 30}s
              </div>
            </div>
          )}
          {/* Settings & Delete Buttons at the very bottom (conditionally rendered) */}
          {showActions && (
            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEditDevice && onEditDevice(device)}
                title="Edit Device"
              >
                <Settings className="h-4 w-4" />
              </Button>
              {onDeleteDevice && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => onDeleteDevice(device.id)}
                  title="Delete Device"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};


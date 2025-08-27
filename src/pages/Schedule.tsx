import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import api from '@/services/api';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Plus, Edit, Trash2 } from 'lucide-react';
import { ScheduleDialog } from '@/components/ScheduleDialog';
import { scheduleAPI } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface Schedule {
  id: string;
  name: string;
  time: string;
  action: 'on' | 'off';
  // Days are user-friendly names for UI, we map to numbers (0-6) when calling the API
  days: string[];
  // Switch IDs are composite `${deviceId}-${switchId}` for UI; map to objects for API
  switches: string[];
  enabled: boolean;
  timeoutMinutes?: number;
}
// Day helpers: backend expects 0-6 (0=Sunday) and cron uses same
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const dayNameToNumber = (name: string): number => {
  const idx = DAY_NAMES.findIndex(d => d.toLowerCase() === name.toLowerCase());
  return idx >= 0 ? idx : 1; // default to Monday
};
const dayNumberToName = (n: number): string => DAY_NAMES[n] ?? 'Monday';
const toSwitchRef = (comboId: string) => {
  const [deviceId, switchId] = comboId.split('-');
  return { deviceId, switchId };
};
const fromSwitchRef = (ref: any): string => `${ref.deviceId}-${ref.switchId}`;


const Schedule: React.FC = () => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const handleDeleteSchedule = async (scheduleId: string) => {
    try {
      const response = await api.delete(`/schedules/${scheduleId}`);
      if (response.data.success) {
        setSchedules(prev => prev.filter(s => s.id !== scheduleId));
        toast({
          title: "Schedule Deleted",
          description: "Schedule has been removed successfully"
        });
      }
    } catch (error) {
      console.error('Delete schedule error:', error);
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete schedule",
        variant: "destructive"
      });
    }
  };

  const handleEditSchedule = async (scheduleData: any) => {
    if (!editingSchedule) return;
    try {
      const payload = {
        name: scheduleData.name,
        time: scheduleData.time,
        action: scheduleData.action,
        type: 'weekly',
        days: (scheduleData.days || []).map((d: string) => dayNameToNumber(d)),
        switches: (scheduleData.switches || []).map((id: string) => toSwitchRef(id)),
        enabled: true,
        timeoutMinutes: scheduleData.timeoutMinutes ?? 0
      };
      const response = await api.put(`/schedules/${editingSchedule.id}`, payload);
      if (response.data.success) {
        const s = response.data.data;
        const updatedSchedule: Schedule = {
          id: s._id || s.id,
          name: s.name,
          time: s.time,
          action: s.action,
          days: (s.days || []).map((n: number) => dayNumberToName(n)),
          switches: (s.switches || []).map(fromSwitchRef),
          enabled: s.enabled,
          timeoutMinutes: s.timeoutMinutes
        };
        setSchedules(prev => 
          prev.map(schedule => 
            schedule.id === editingSchedule.id 
              ? updatedSchedule
              : schedule
          )
        );
        setEditingSchedule(null);
        toast({
          title: "Schedule Updated",
          description: `${scheduleData.name} has been updated successfully`
        });
      }
    } catch (error) {
      console.error('Edit schedule error:', error);
      toast({
        title: "Error",
        description: error.response?.data?.message || error.response?.data?.error || "Failed to update schedule",
        variant: "destructive"
      });
    }
  };

  const handleAddSchedule = async (scheduleData: any) => {
    try {
      const payload = {
        name: scheduleData.name,
        time: scheduleData.time,
        action: scheduleData.action,
        type: 'weekly',
        days: (scheduleData.days || []).map((d: string) => dayNameToNumber(d)),
        switches: (scheduleData.switches || []).map((id: string) => toSwitchRef(id)),
        enabled: true,
        timeoutMinutes: scheduleData.timeoutMinutes ?? 0
      };
      const response = await api.post('/schedules', payload);
      if (response.data.success) {
        const s = response.data.data;
        const newSchedule: Schedule = {
          id: s._id || s.id,
          name: s.name,
          time: s.time,
          action: s.action,
          days: (s.days || []).map((n: number) => dayNumberToName(n)),
          switches: (s.switches || []).map(fromSwitchRef),
          enabled: s.enabled,
          timeoutMinutes: s.timeoutMinutes
        };
        setSchedules(prev => [...prev, newSchedule]);
        toast({
          title: "Schedule Added",
          description: `${scheduleData.name} has been scheduled successfully`
        });
      }
    } catch (error) {
      console.error('Add schedule error:', error);
      toast({
        title: "Error",
        description: error.response?.data?.message || error.response?.data?.error || "Failed to add schedule",
        variant: "destructive"
      });
    }
  };
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const response = await api.get('/schedules');
        if (response.data.success) {
          const mapped = response.data.data.map((s: any) => ({
            id: s._id || s.id,
            name: s.name,
            time: s.time,
            action: s.action,
            days: Array.isArray(s.days) ? s.days.map((n: number) => dayNumberToName(n)) : [],
            switches: Array.isArray(s.switches) ? s.switches.map(fromSwitchRef) : [],
            enabled: s.enabled,
            timeoutMinutes: s.timeoutMinutes
          }));
          setSchedules(mapped);
        } else {
          toast({
            title: "Error",
            description: "Failed to fetch schedules",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Schedule fetch error:', error);
        toast({
          title: "Error",
          description: error.response?.data?.message || error.response?.data?.error || "Failed to fetch schedules",
          variant: "destructive"
        });
      }
    };
    fetchSchedules();
  }, [toast]);

  const runScheduleNow = async (scheduleId: string) => {
    try {
      await scheduleAPI.runNow(scheduleId);
      toast({ title: 'Schedule Executed', description: 'Triggered immediately. Check device state.' });
    } catch (error: any) {
      console.error('Run-now error:', error);
      toast({ title: 'Error', description: error.response?.data?.message || error.response?.data?.error || 'Failed to run schedule', variant: 'destructive' });
    }
  };

  const toggleSchedule = async (scheduleId: string) => {
    const target = schedules.find(s => s.id === scheduleId);
    if (!target) return;
    try {
      const response = await api.put(`/schedules/${scheduleId}`, { enabled: !target.enabled });
      if (response.data.success) {
        setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, enabled: !target.enabled } : s));
        toast({ title: 'Schedule Updated', description: `${target.name} ${!target.enabled ? 'enabled' : 'disabled'}` });
      }
    } catch (error: any) {
      console.error('Toggle schedule error:', error);
      toast({ title: 'Error', description: error.response?.data?.message || error.response?.data?.error || 'Failed to update schedule', variant: 'destructive' });
    }
  };

  return (
    <>
      {/* Top Bar / Toolbar */}
      <div className="flex items-center justify-between py-4 px-2 bg-background border-b mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-foreground">Schedule Management</h1>
          <span className="text-muted-foreground text-sm">Automate classroom lighting and devices</span>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Schedule
        </Button>
      </div>
      {/* Main Content */}
      <div className="space-y-6">
        {schedules.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No schedules configured</h3>
            <p className="text-muted-foreground mb-4">
              Create automated schedules for your classroom devices
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Schedule
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schedules.map((schedule) => (
              <Card key={schedule.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {schedule.name}
                    </CardTitle>
                    <div className="flex gap-1">
                      <Badge variant={schedule.enabled ? 'default' : 'secondary'}>
                        {schedule.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Time:</span>
                      <span className="text-sm">{schedule.time}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Action:</span>
                      <Badge variant={schedule.action === 'on' ? 'default' : 'outline'}>
                        Turn {schedule.action}
                      </Badge>
                    </div>
                    {schedule.timeoutMinutes && schedule.timeoutMinutes > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Timeout:</span>
                        <span className="text-xs text-orange-600">
                          {Math.floor(schedule.timeoutMinutes / 60)}h {schedule.timeoutMinutes % 60}m
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-sm font-medium">Days:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {schedule.days.map((day) => (
                          <Badge key={day} variant="outline" className="text-xs">
                            {day.slice(0, 3)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Devices:</span>
                      <div className="text-xs text-muted-foreground mt-1">
                        {schedule.switches.length} device(s) selected
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingSchedule(schedule);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => runScheduleNow(schedule.id)}
                        title="Run now"
                      >
                        Run Now
                      </Button>
                      <Button
                        size="sm"
                        variant={schedule.enabled ? 'secondary' : 'default'}
                        onClick={() => toggleSchedule(schedule.id)}
                      >
                        {schedule.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setConfirmDeleteId(schedule.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
      {/* Confirm Delete Schedule Dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-2">Delete Schedule</h3>
            <p className="mb-4">Are you sure you want to delete this schedule? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  await handleDeleteSchedule(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <ScheduleDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditingSchedule(null);
          }}
          onSave={editingSchedule ? handleEditSchedule : handleAddSchedule}
          schedule={editingSchedule}
        />
      </div>
    </>
  );
};

export default Schedule;

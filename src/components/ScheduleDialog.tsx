
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useDevices } from '@/hooks/useDevices';
import { useToast } from '@/hooks/use-toast';

interface ScheduleData {
  name: string;
  time: string;
  action: 'on' | 'off';
  days: string[];
  switches: string[];
  timeoutMinutes?: number;
  selectedClassroom?: string;
  selectedType?: string;
}

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (schedule: ScheduleData) => void;
  schedule?: any;
}

const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

export const ScheduleDialog: React.FC<ScheduleDialogProps> = ({ 
  open, 
  onOpenChange, 
  onSave, 
  schedule 
}) => {
  const { devices } = useDevices();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<ScheduleData>({
    name: schedule?.name || '',
    time: schedule?.time || '',
    action: schedule?.action || 'on',
    days: schedule?.days || [],
    switches: schedule?.switches || [],
    timeoutMinutes: schedule?.timeoutMinutes,
    selectedClassroom: '',
    selectedType: ''
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Keep form in sync when editing a schedule
  React.useEffect(() => {
    if (schedule && open) {
      setFormData({
        name: schedule.name || '',
  time: schedule.time || '',
        action: schedule.action || 'on',
        days: Array.isArray(schedule.days) ? schedule.days : [],
        switches: Array.isArray(schedule.switches) ? schedule.switches : [],
  timeoutMinutes: schedule.timeoutMinutes
      });
    } else if (!open && !schedule) {
      // Reset when closing after adding
  setFormData({ name: '', time: '', action: 'on', days: [], switches: [], timeoutMinutes: undefined });
    }
  }, [schedule, open]);

  const allSwitches = devices.flatMap(device =>
    device.switches.map(sw => ({
      id: `${device.id}-${sw.id}`,
      name: `${sw.name} (${device.name})`,
      deviceName: device.name,
      location: device.location,
      classroom: device.classroom || 'Other',
      type: sw.type || 'other'
    }))
  );

  const handleDayToggle = (day: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({ ...prev, days: [...prev.days, day] }));
    } else {
      setFormData(prev => ({ ...prev, days: prev.days.filter(d => d !== day) }));
    }
  };

  const handleSwitchToggle = (switchId: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({ ...prev, switches: [...prev.switches, switchId] }));
    } else {
      setFormData(prev => ({ ...prev, switches: prev.switches.filter(s => s !== switchId) }));
    }
  };

  const handleSave = () => {
    if (!formData.name || !formData.time || formData.days.length === 0 || formData.switches.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    onSave(formData);
    onOpenChange(false);
    
    // Reset form for new schedules
    if (!schedule) {
      setFormData({
        name: '',
        time: '09:00',
        action: 'on',
        days: [],
        switches: [],
        timeoutMinutes: 480
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {schedule ? 'Edit Schedule' : 'Add New Schedule'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Schedule Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Morning Classroom Lights"
              />
            </div>
            <div>
              <Label htmlFor="time">Time *</Label>
              <Input
                id="time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="action">Action *</Label>
              <Select value={formData.action} onValueChange={(value) => setFormData(prev => ({ ...prev, action: value as 'on' | 'off' }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on">Turn On</SelectItem>
                  <SelectItem value="off">Turn Off</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Choose whether the schedule should turn the device on or off at the specified time.
              </p>
            </div>
          </div>

          <div>
            <Label>Days *</Label>
            <div className="grid grid-cols-4 gap-2 mt-2">
              {DAYS_OF_WEEK.map(day => (
                <div key={day} className="flex items-center space-x-2">
                  <Checkbox
                    id={day}
                    checked={formData.days.includes(day)}
                    onCheckedChange={(checked) => handleDayToggle(day, checked as boolean)}
                  />
                  <Label htmlFor={day} className="text-sm">{day.slice(0, 3)}</Label>
                </div>
              ))}
            </div>
          </div>

            <div>
              <Label>Select Switches/Devices *</Label>
              <Input
                type="text"
                placeholder="Search devices or switches..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="mb-2"
              />
              <div className="flex gap-4 mb-2">
                <Select onValueChange={selectedClassroom => setFormData(prev => ({ ...prev, selectedClassroom }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Classroom" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...new Set(allSwitches.map(sw => sw.classroom))].map(classroom => (
                      <SelectItem key={classroom} value={classroom}>{classroom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select onValueChange={selectedType => setFormData(prev => ({ ...prev, selectedType }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...new Set(allSwitches.map(sw => sw.type))].map(type => (
                      <SelectItem key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Select All checkbox */}
              <div className="mb-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={(() => {
                      const visibleSwitchIds = Array.from(
                        allSwitches
                          .filter(sw =>
                            (!formData.selectedClassroom || sw.classroom === formData.selectedClassroom) &&
                            (!formData.selectedType || sw.type === formData.selectedType) &&
                            (searchTerm === '' || sw.name.toLowerCase().includes(searchTerm.toLowerCase()) || sw.deviceName.toLowerCase().includes(searchTerm.toLowerCase()))
                          )
                      ).map(sw => sw.id);
                      return visibleSwitchIds.length > 0 && visibleSwitchIds.every(id => formData.switches.includes(id));
                    })()}
                    onChange={e => {
                      const visibleSwitchIds = Array.from(
                        allSwitches
                          .filter(sw =>
                            (!formData.selectedClassroom || sw.classroom === formData.selectedClassroom) &&
                            (!formData.selectedType || sw.type === formData.selectedType) &&
                            (searchTerm === '' || sw.name.toLowerCase().includes(searchTerm.toLowerCase()) || sw.deviceName.toLowerCase().includes(searchTerm.toLowerCase()))
                          )
                      ).map(sw => sw.id);
                      if (e.target.checked) {
                        setFormData(prev => ({
                          ...prev,
                          switches: Array.from(new Set([...prev.switches, ...visibleSwitchIds]))
                        }));
                      } else {
                        setFormData(prev => ({
                          ...prev,
                          switches: prev.switches.filter(id => !visibleSwitchIds.includes(id))
                        }));
                      }
                    }}
                  />
                  <span className="text-sm">Select All</span>
                </label>
              </div>
              {/* Grouped display by classroom and type */}
              <div className="max-h-40 overflow-y-auto border rounded p-3 mt-2">
                {Array.from(
                  allSwitches
                    .filter(sw =>
                      (!formData.selectedClassroom || sw.classroom === formData.selectedClassroom) &&
                      (!formData.selectedType || sw.type === formData.selectedType) &&
                      (searchTerm === '' || sw.name.toLowerCase().includes(searchTerm.toLowerCase()) || sw.deviceName.toLowerCase().includes(searchTerm.toLowerCase()))
                    )
                    .reduce((acc, sw) => {
                      const key = `${sw.classroom}-${sw.type}`;
                      if (!acc.has(key)) acc.set(key, []);
                      acc.get(key).push(sw);
                      return acc;
                    }, new Map())
                ).map(([group, switches]) => (
                  <div key={group} className="mb-2">
                    <div className="font-semibold text-xs mb-1">{group.replace('-', ' / ')}</div>
                    {switches.map(sw => (
                      <div key={sw.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={sw.id}
                          checked={formData.switches.includes(sw.id)}
                          onCheckedChange={(checked) => handleSwitchToggle(sw.id, checked as boolean)}
                        />
                        <Label htmlFor={sw.id} className="text-sm flex-1">
                          {sw.name}
                          <span className="text-muted-foreground ml-2">({sw.location})</span>
                        </Label>
                        <span className={`ml-2 text-xs ${devices.find(d => d.id === sw.id.split('-')[0])?.status === 'online' ? 'text-green-600' : 'text-red-600'}`}>
                          {devices.find(d => d.id === sw.id.split('-')[0])?.status || 'unknown'}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

          {/* Schedule summary preview */}
          <div className="border rounded p-3 my-4 bg-muted">
            <div className="font-semibold mb-2">Schedule Preview</div>
            <div><b>Name:</b> {formData.name}</div>
            <div><b>Time:</b> {formData.time}</div>
            <div><b>Action:</b> {formData.action === 'on' ? 'Turn On' : 'Turn Off'}</div>
            <div><b>Days:</b> {formData.days.join(', ')}</div>
            <div><b>Devices/Switches:</b> {formData.switches.length}</div>
            <div><b>Timeout:</b> {formData.timeoutMinutes ? formData.timeoutMinutes + ' min' : 'None'}</div>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {schedule ? 'Update Schedule' : 'Add Schedule'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

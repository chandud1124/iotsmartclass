
import { useState } from 'react';
import { useDevices } from './useDevices';

interface CustomMasterSwitch {
  id: string;
  name: string;
  accessCode?: string;
  switches: string[]; // Array of "deviceId-switchId" strings
  isActive: boolean;
}

export const useCustomMasterSwitches = () => {
  // Toggle only online devices in a custom switch group
  const toggleOnlineDevicesInCustomSwitch = async (customSwitchId: string, state: boolean, onlineSwitchIds: string[]) => {
    const customSwitch = customSwitches.find(sw => sw.id === customSwitchId);
    if (!customSwitch) return;
    for (const switchRef of onlineSwitchIds) {
      const [deviceId, switchId] = switchRef.split('-');
      await toggleSwitch(deviceId, switchId);
    }
    setCustomSwitches(prev => {
      const updated = prev.map(sw =>
        sw.id === customSwitchId ? { ...sw, isActive: state } : sw
      );
      localStorage.setItem('customMasterSwitches', JSON.stringify(updated));
      return updated;
    });
  };
  const { devices, toggleSwitch } = useDevices();
  const [customSwitches, setCustomSwitches] = useState<CustomMasterSwitch[]>(() => {
    try {
      const saved = localStorage.getItem('customMasterSwitches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const addCustomSwitch = (switchData: Omit<CustomMasterSwitch, 'id' | 'isActive'>) => {
    const newSwitch: CustomMasterSwitch = {
      id: Date.now().toString(),
      isActive: false,
      ...switchData
    };
    setCustomSwitches(prev => {
      const updated = [...prev, newSwitch];
      localStorage.setItem('customMasterSwitches', JSON.stringify(updated));
      return updated;
    });
  };

  const deleteCustomSwitch = (switchId: string) => {
    setCustomSwitches(prev => {
      const updated = prev.filter(sw => sw.id !== switchId);
      localStorage.setItem('customMasterSwitches', JSON.stringify(updated));
      return updated;
    });
  };

  const toggleCustomSwitch = async (customSwitchId: string, state: boolean) => {
    const customSwitch = customSwitches.find(sw => sw.id === customSwitchId);
    if (!customSwitch) return;

    // Toggle all switches in the group
    for (const switchRef of customSwitch.switches) {
      const [deviceId, switchId] = switchRef.split('-');
      await toggleSwitch(deviceId, switchId);
    }

    // Update the custom switch state
    setCustomSwitches(prev => {
      const updated = prev.map(sw =>
        sw.id === customSwitchId ? { ...sw, isActive: state } : sw
      );
      localStorage.setItem('customMasterSwitches', JSON.stringify(updated));
      return updated;
    });
  };

  // Update isActive state based on actual switch states
  const updateCustomSwitchStates = () => {
    setCustomSwitches(prev => {
      const updated = prev.map(customSwitch => {
        const allOn = customSwitch.switches.every(switchRef => {
          const [deviceId, switchId] = switchRef.split('-');
          const device = devices.find(d => d.id === deviceId);
          const switch_ = device?.switches.find(s => s.id === switchId);
          return switch_?.state === true;
        });
        return { ...customSwitch, isActive: allOn };
      });
      localStorage.setItem('customMasterSwitches', JSON.stringify(updated));
      return updated;
    });
  };

  return {
    customSwitches,
    addCustomSwitch,
    deleteCustomSwitch,
    toggleCustomSwitch,
    toggleOnlineDevicesInCustomSwitch,
    updateCustomSwitchStates
  };
};

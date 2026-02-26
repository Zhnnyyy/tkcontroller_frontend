'use client';

import { Device } from '@/lib/types';
import { ChevronDown, Zap, AlertCircle } from 'lucide-react';

interface DeviceSelectorProps {
  devices: Device[];
  selectedDeviceId: string | null;
  onSelectDevice: (deviceId: string) => void;
}

export const DeviceSelector = ({
  devices,
  selectedDeviceId,
  onSelectDevice,
}: DeviceSelectorProps) => {
  const selectedDevice = devices.find((d) => d.device_id === selectedDeviceId);

  return (
    <div className="relative">
      <label className="block text-sm font-semibold mb-2 text-foreground">
        Select Device
      </label>
      <select
        value={selectedDeviceId || ''}
        onChange={(e) => onSelectDevice(e.target.value)}
        className={`
          w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground
          appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary
          font-medium transition-colors
        `}
      >
        <option value="">Choose a device...</option>
        {devices.map((device) => (
          <option key={device.device_id} value={device.device_id}>
            {device.device_name} ({device.device_id})
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-11 w-5 h-5 pointer-events-none text-foreground/50" />

      {selectedDevice && (
        <div className="mt-3 p-3 bg-input border border-border rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {selectedDevice.device_name}
              </p>
              <p className="text-xs text-foreground/60 font-mono">
                {selectedDevice.device_id}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {selectedDevice.connection_status === 'connected' ? (
                <>
                  <Zap className="w-4 h-4 text-success" />
                  <span className="text-xs font-medium text-success">Online</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-warning" />
                  <span className="text-xs font-medium text-warning">Offline</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

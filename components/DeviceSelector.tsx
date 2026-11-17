'use client';

import { useState } from 'react';
import { Device } from '@/lib/types';
import { ChevronDown, Zap, AlertCircle, Shield, ExternalLink, Copy, Check, Settings2 } from 'lucide-react';

interface DeviceSelectorProps {
  devices: Device[];
  selectedDeviceId: string | null;
  onSelectDevice: (deviceId: string) => void;
  onOpenProvisioning?: () => void;
}

export const DeviceSelector = ({
  devices,
  selectedDeviceId,
  onSelectDevice,
  onOpenProvisioning,
}: DeviceSelectorProps) => {
  const selectedDevice = devices.find((d) => d.device_id === selectedDeviceId);
  const [copied, setCopied] = useState(false);

  const rustdeskId = selectedDevice?.rustdesk_id || selectedDevice?.zhentinel_id;
  const isZhentinelRunning = selectedDevice?.zhentinel_status === 'running' || Boolean(rustdeskId);

  const handleCopyId = () => {
    if (rustdeskId) {
      navigator.clipboard.writeText(rustdeskId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConnectRemote = () => {
    if (rustdeskId) {
      window.location.href = `rustdesk://${rustdeskId}`;
    }
  };

  return (
    <div className="relative space-y-4">
      <div>
        <label className="block text-sm font-semibold mb-2 text-foreground">
          Select Device
        </label>
        <div className="relative">
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
          <ChevronDown className="absolute right-3 top-3.5 w-5 h-5 pointer-events-none text-foreground/50" />
        </div>
      </div>

      {selectedDevice && (
        <div className="p-3.5 bg-input border border-border rounded-lg space-y-3">
          {/* Device Basic Status */}
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">
                {selectedDevice.device_name}
              </p>
              <p className="text-xs text-foreground/60 font-mono">
                ID: {selectedDevice.device_id}
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-background/50 border border-border text-xs">
              {selectedDevice.connection_status === 'connected' ? (
                <>
                  <Zap className="w-3.5 h-3.5 text-success animate-pulse" />
                  <span className="font-medium text-success">Online</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-warning" />
                  <span className="font-medium text-warning">Offline</span>
                </>
              )}
            </div>
          </div>

          {/* Zhentinel Remote Card */}
          <div className="pt-3 border-t border-border/70">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Shield className="w-3.5 h-3.5 text-primary" />
                <span>Zhentinel Remote</span>
              </div>
              <span
                className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                  isZhentinelRunning
                    ? 'bg-success/20 text-success border border-success/30'
                    : 'bg-foreground/10 text-foreground/60'
                }`}
              >
                {isZhentinelRunning ? 'Host Active' : 'Stopped'}
              </span>
            </div>

            {rustdeskId ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-background p-2 rounded border border-border/60">
                  <span className="text-xs text-foreground/70 font-medium">RustDesk ID:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-primary tracking-wide">
                      {rustdeskId}
                    </span>
                    <button
                      onClick={handleCopyId}
                      className="p-1 rounded hover:bg-white/10 text-foreground/60 hover:text-foreground transition-colors"
                      title="Copy ID"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleConnectRemote}
                    className="flex-1 py-1.5 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 flex items-center justify-center gap-1.5 transition-all shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Connect</span>
                  </button>
                  {onOpenProvisioning && (
                    <button
                      onClick={onOpenProvisioning}
                      className="py-1.5 px-2.5 rounded-md border border-border hover:bg-white/10 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                      title="Configure Credentials"
                    >
                      <Settings2 className="w-3.5 h-3.5 text-foreground/80" />
                      <span>Config</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-foreground/50 italic">
                  Host ID not discovered yet. Start the service or configure credentials.
                </p>
                {onOpenProvisioning && (
                  <button
                    onClick={onOpenProvisioning}
                    className="w-full py-1.5 px-3 rounded-md border border-border hover:bg-white/10 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Settings2 className="w-3.5 h-3.5 text-primary" />
                    <span>Configure Remote Host</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

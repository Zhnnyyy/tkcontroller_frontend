'use client';

import { useState } from 'react';
import { Device } from '@/lib/types';
import { ChevronDown, Zap, AlertCircle, Shield, ExternalLink, Copy, Check, Settings2, Users, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/components/AuthGate';
import { useSocket } from '@/components/SocketProvider';
import { ConfirmDialog } from '@/components/ConfirmDialog';

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
  const { session } = useAuth();
  const { socket } = useSocket();
  const selectedDevice = devices.find((d) => d.device_id === selectedDeviceId);
  const [copied, setCopied] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [warnSessionOpen, setWarnSessionOpen] = useState(false);

  const rustdeskId = selectedDevice?.rustdesk_id || selectedDevice?.zhentinel_id;
  const isZhentinelRunning = selectedDevice?.zhentinel_status === 'running' || Boolean(rustdeskId);
  const sessionInUse = Boolean(selectedDevice?.session_in_use);
  const sessionOperator = selectedDevice?.session_operator || 'Another Operator';

  const handleCopyId = () => {
    if (rustdeskId) {
      navigator.clipboard.writeText(rustdeskId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const executeConnect = async () => {
    if (!rustdeskId) return;
    const pwd = selectedDevice?.zhentinel_password || 'Lbrdc2021.';
    try {
      await navigator.clipboard.writeText(pwd);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 3500);
    } catch (e) {
      console.warn('Clipboard write failed', e);
    }

    if (socket && selectedDevice) {
      socket.emit('operator_session_start', {
        device_id: selectedDevice.device_id,
        operator: session?.username || 'Operator',
        type: 'rustdesk',
      });
    }

    window.location.href = `rustdesk://${rustdeskId}`;
  };

  const handleConnectRemote = () => {
    if (sessionInUse) {
      setWarnSessionOpen(true);
    } else {
      executeConnect();
    }
  };

  return (
    <div className="relative space-y-3 sm:space-y-4">
      <div>
        <label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2 text-foreground">
          Select Device
        </label>
        <div className="relative">
          <select
            value={selectedDeviceId || ''}
            onChange={(e) => onSelectDevice(e.target.value)}
            className={`
              w-full px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-lg bg-input border border-border text-foreground
              appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary
              text-xs sm:text-sm font-medium transition-colors
            `}
          >
            <option value="">Choose a device...</option>
            {devices.map((device) => (
              <option key={device.device_id} value={device.device_id}>
                {device.device_name} ({device.device_id}) {device.session_in_use ? '🔴 [In-Use]' : ''}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-2.5 sm:top-3.5 w-4 h-4 sm:w-5 sm:h-5 pointer-events-none text-foreground/50" />
        </div>
      </div>

      {selectedDevice && (
        <div className="p-3 sm:p-3.5 bg-input border border-border rounded-lg space-y-3">
          {/* Device Basic Status */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                {selectedDevice.device_name}
              </p>
              <p className="text-[10px] sm:text-xs text-foreground/60 font-mono truncate">
                ID: {selectedDevice.device_id}
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-background/50 border border-border text-[11px] sm:text-xs shrink-0">
              {selectedDevice.connection_status === 'connected' ? (
                <>
                  <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-success animate-pulse" />
                  <span className="font-medium text-success">Online</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-warning" />
                  <span className="font-medium text-warning">Offline</span>
                </>
              )}
            </div>
          </div>

          {/* Session In-Use Alert Badge if active */}
          {sessionInUse && (
            <div className="p-2 rounded-lg bg-error/15 border border-error/30 text-error text-[11px] flex items-center justify-between gap-1.5 animate-pulse">
              <div className="flex items-center gap-1.5 truncate">
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span className="font-semibold truncate">Session Active: {sessionOperator}</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-error/20">IN-USE</span>
            </div>
          )}

          {/* Zhentinel Remote Card */}
          <div className="pt-2.5 sm:pt-3 border-t border-border/70">
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">Zhentinel Remote</span>
              </div>
              <span
                className={`text-[10px] sm:text-[11px] px-2 py-0.5 rounded font-medium shrink-0 ${
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
                <div className="flex items-center justify-between bg-background p-2 rounded border border-border/60 gap-2">
                  <span className="text-[11px] sm:text-xs text-foreground/70 font-medium shrink-0">RustDesk ID:</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono text-xs font-bold text-primary tracking-wide truncate">
                      {rustdeskId}
                    </span>
                    <button
                      onClick={handleCopyId}
                      className="p-1 rounded hover:bg-white/10 text-foreground/60 hover:text-foreground transition-colors shrink-0"
                      title="Copy ID"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {passwordCopied && (
                  <div className="p-1.5 rounded bg-success/15 border border-success/30 text-success text-[11px] flex items-center justify-center gap-1 font-medium animate-in fade-in">
                    <Check className="w-3 h-3 shrink-0" />
                    <span>Password Copied! Press Ctrl+V in RustDesk</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleConnectRemote}
                    className="flex-1 py-1.5 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    title="Copy permanent password and open RustDesk client"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{passwordCopied ? 'Launching...' : 'Connect'}</span>
                  </button>
                  {onOpenProvisioning && (
                    <button
                      onClick={onOpenProvisioning}
                      className="py-1.5 px-2.5 rounded-md border border-border hover:bg-white/10 text-xs font-medium flex items-center justify-center gap-1 transition-colors shrink-0"
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

      {/* Concurrent Session Warning Dialog */}
      <ConfirmDialog
        open={warnSessionOpen}
        title="Active Remote Session In Progress"
        description={`Administrator "${sessionOperator}" is currently connected to this device. Connecting simultaneously may disrupt their remote session. Do you want to copy the password and connect anyway?`}
        confirmLabel="Connect Anyway"
        cancelLabel="Cancel"
        onConfirm={() => {
          setWarnSessionOpen(false);
          executeConnect();
        }}
        onCancel={() => setWarnSessionOpen(false)}
      />
    </div>
  );
};

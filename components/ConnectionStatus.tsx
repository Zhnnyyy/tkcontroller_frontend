'use client';

import { Zap, AlertCircle, Loader2 } from 'lucide-react';
import { Device } from '@/lib/types';

interface ConnectionStatusProps {
  isConnected: boolean;
  deviceCount: number;
  devices: Device[];
}

export const ConnectionStatus = ({
  isConnected,
  deviceCount,
  devices,
}: ConnectionStatusProps) => {
  const connectedDevices = devices.filter(
    (d) => d.connection_status === 'connected'
  ).length;

  return (
    <div className="flex flex-wrap gap-4 p-4 bg-input border border-border rounded-lg">
      {/* Socket Status */}
      <div className="flex items-center gap-2">
        {isConnected ? (
          <>
            <Zap className="w-5 h-5 text-success animate-pulse" />
            <div>
              <p className="text-sm font-medium text-foreground">Connected</p>
              <p className="text-xs text-foreground/60">Socket.io</p>
            </div>
          </>
        ) : (
          <>
            <Loader2 className="w-5 h-5 text-warning animate-spin" />
            <div>
              <p className="text-sm font-medium text-foreground">Connecting...</p>
              <p className="text-xs text-foreground/60">Socket.io</p>
            </div>
          </>
        )}
      </div>

      {/* Device Count */}
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 bg-primary/30 rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-primary rounded-full" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {deviceCount} Device{deviceCount !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-foreground/60">Total</p>
        </div>
      </div>

      {/* Connected Devices */}
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 bg-success/30 rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-success rounded-full" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {connectedDevices} Online
          </p>
          <p className="text-xs text-foreground/60">Connected</p>
        </div>
      </div>
    </div>
  );
};

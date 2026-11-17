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
    <div className="grid grid-cols-3 gap-2 sm:gap-4 p-3 sm:p-4 bg-input border border-border rounded-lg">
      {/* Socket Status */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {isConnected ? (
          <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-success animate-pulse shrink-0" />
        ) : (
          <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-warning animate-spin shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
            {isConnected ? 'Connected' : 'Connecting...'}
          </p>
          <p className="text-[10px] sm:text-xs text-foreground/60 truncate">Socket.io</p>
        </div>
      </div>

      {/* Device Count */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="w-4 h-4 sm:w-5 sm:h-5 bg-primary/30 rounded-full flex items-center justify-center shrink-0">
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary rounded-full" />
        </div>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
            {deviceCount} Device{deviceCount !== 1 ? 's' : ''}
          </p>
          <p className="text-[10px] sm:text-xs text-foreground/60 truncate">Total</p>
        </div>
      </div>

      {/* Connected Devices */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="w-4 h-4 sm:w-5 sm:h-5 bg-success/30 rounded-full flex items-center justify-center shrink-0">
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-success rounded-full" />
        </div>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
            {connectedDevices} Online
          </p>
          <p className="text-[10px] sm:text-xs text-foreground/60 truncate">Connected</p>
        </div>
      </div>
    </div>
  );
};

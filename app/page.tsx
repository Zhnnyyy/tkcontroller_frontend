'use client';

import { useState, useEffect } from 'react';
import { useSocket } from '@/components/SocketProvider';
import { DeviceSelector } from '@/components/DeviceSelector';
import { CommandGrid } from '@/components/CommandGrid';
import { ResponseDisplay } from '@/components/ResponseDisplay';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { CommandExecutionState } from '@/lib/types';
import { Settings, RotateCcw } from 'lucide-react';
import { useAuth } from '@/components/AuthGate';
import { RemoteMonitor } from '@/components/RemoteMonitor';

export default function Home() {
  const { logout, session } = useAuth();
  const { socket, isConnected, devices } = useSocket();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<CommandExecutionState | null>(null);

  // Auto-select first device when devices load
  useEffect(() => {
    if (devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devices[0].device_id);
    }
  }, [devices, selectedDeviceId]);

  const handleCommandExecute = (state: CommandExecutionState) => {
    setLastResponse(state);
  };

  const handleRefreshDevices = () => {
    if (socket) {
      socket.emit('get_devices');
    }
  };

  const selectedDevice =
    devices.find((device) => device.device_id === selectedDeviceId) ?? null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-input">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                Device Controller
              </h1>
              <p className="text-foreground/60 text-sm mt-1">
                Manage and control your devices with ease
              </p>
            </div>
            <div className="flex gap-2">
              <div className="hidden sm:flex items-center text-xs text-foreground/60 mr-2">
                {session?.username}
              </div>
              <button
                onClick={handleRefreshDevices}
                className="btn-ghost"
                aria-label="Refresh devices"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <button
                className="btn-ghost"
                aria-label="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={logout}
                className="btn-ghost"
                aria-label="Logout"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Connection Status */}
        <div className="mb-8">
          <ConnectionStatus
            isConnected={isConnected}
            deviceCount={devices.length}
            devices={devices}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="card sticky top-6">
              <DeviceSelector
                devices={devices}
                selectedDeviceId={selectedDeviceId}
                onSelectDevice={setSelectedDeviceId}
              />
            </div>
          </div>

          {/* Main Panel */}
          <div className="lg:col-span-2 space-y-8">
            <RemoteMonitor socket={socket} device={selectedDevice} />

            {/* Commands Section */}
            <section>
              <h2 className="text-xl font-bold text-foreground mb-4">
                Available Commands
              </h2>
              <CommandGrid
                deviceId={selectedDeviceId}
                socket={socket}
                onCommandExecute={handleCommandExecute}
              />
            </section>

            {/* Response Section */}
            <section>
              <h2 className="text-xl font-bold text-foreground mb-4">
                Execution Result
              </h2>
              <ResponseDisplay
                state={lastResponse}
                onClear={() => setLastResponse(null)}
              />
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-input mt-12 sm:mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 text-center text-sm text-foreground/60">
          <p>Device Controller v1.0 • Connected to backend</p>
        </div>
      </footer>
    </div>
  );
}

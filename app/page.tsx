'use client';

import { useState, useEffect } from 'react';
import { useSocket } from '@/components/SocketProvider';
import { DeviceSelector } from '@/components/DeviceSelector';
import { CommandGrid } from '@/components/CommandGrid';
import { ResponseDisplay } from '@/components/ResponseDisplay';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { CommandExecutionState } from '@/lib/types';
import { Settings, RotateCcw, Tv, FolderOpen, Terminal as TerminalIcon, Cpu } from 'lucide-react';
import { useAuth } from '@/components/AuthGate';
import { RemoteMonitor } from '@/components/RemoteMonitor';
import { FileManager } from '@/components/FileManager';
import { Terminal } from '@/components/Terminal';
import { ProvisioningModal } from '@/components/ProvisioningModal';

type TabId = 'monitor' | 'files' | 'terminal' | 'commands';

export default function Home() {
  const { logout, session } = useAuth();
  const { socket, isConnected, devices } = useSocket();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<CommandExecutionState | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('monitor');
  const [isProvisioningOpen, setIsProvisioningOpen] = useState(false);

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
                onOpenProvisioning={() => setIsProvisioningOpen(true)}
              />
            </div>
          </div>

          {/* Main Panel */}
          <div className="lg:col-span-2 flex flex-col">
            {/* Tabs Navigation */}
            <div className="flex border-b border-border mb-6 overflow-x-auto whitespace-nowrap scrollbar-thin">
              <button
                onClick={() => setActiveTab('monitor')}
                className={`py-3 px-6 font-medium text-sm transition-all border-b-2 -mb-[2px] flex items-center gap-2 ${
                  activeTab === 'monitor'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-foreground/60 hover:text-foreground hover:border-border'
                }`}
              >
                <Tv className="w-4 h-4" />
                Remote & Screen
              </button>
              <button
                onClick={() => setActiveTab('files')}
                className={`py-3 px-6 font-medium text-sm transition-all border-b-2 -mb-[2px] flex items-center gap-2 ${
                  activeTab === 'files'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-foreground/60 hover:text-foreground hover:border-border'
                }`}
              >
                <FolderOpen className="w-4 h-4" />
                File Manager
              </button>
              <button
                onClick={() => setActiveTab('terminal')}
                className={`py-3 px-6 font-medium text-sm transition-all border-b-2 -mb-[2px] flex items-center gap-2 ${
                  activeTab === 'terminal'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-foreground/60 hover:text-foreground hover:border-border'
                }`}
              >
                <TerminalIcon className="w-4 h-4" />
                Terminal
              </button>
              <button
                onClick={() => setActiveTab('commands')}
                className={`py-3 px-6 font-medium text-sm transition-all border-b-2 -mb-[2px] flex items-center gap-2 ${
                  activeTab === 'commands'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-foreground/60 hover:text-foreground hover:border-border'
                }`}
              >
                <Cpu className="w-4 h-4" />
                Commands & Output
              </button>
            </div>

            {/* Tab Panes */}
            <div className="space-y-6">
              <div className={activeTab === 'monitor' ? '' : 'hidden'}>
                <RemoteMonitor socket={socket} device={selectedDevice} />
              </div>
              
              <div className={activeTab === 'files' ? '' : 'hidden'}>
                <FileManager socket={socket} device={selectedDevice} />
              </div>
              
              <div className={activeTab === 'terminal' ? '' : 'hidden'}>
                <Terminal socket={socket} device={selectedDevice} />
              </div>
              
              <div className={activeTab === 'commands' ? 'space-y-6' : 'hidden'}>
                {/* Commands Section */}
                <section className="bg-input border border-border rounded-lg p-6">
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
                <section className="bg-input border border-border rounded-lg p-6">
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
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-input mt-12 sm:mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 text-center text-sm text-foreground/60">
          <p>Device Controller v1.0 • Connected to backend</p>
        </div>
      </footer>

      {/* Provisioning Modal */}
      {selectedDevice && (
        <ProvisioningModal
          device={selectedDevice}
          socket={socket}
          isOpen={isProvisioningOpen}
          onClose={() => setIsProvisioningOpen(false)}
          onSuccess={(msg) => {
            setLastResponse({
              command: 'update_remote_provisioning',
              status: 'success',
              response: { success: true, message: msg },
              timestamp: new Date().toISOString(),
            });
          }}
        />
      )}
    </div>
  );
}

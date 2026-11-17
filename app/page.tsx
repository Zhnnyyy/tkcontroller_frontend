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
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground truncate">
                Device Controller
              </h1>
              <p className="text-foreground/60 text-xs sm:text-sm mt-0.5 sm:mt-1 truncate">
                Manage and control your devices with ease
              </p>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <div className="hidden md:flex items-center text-xs text-foreground/60 mr-1 sm:mr-2">
                {session?.username}
              </div>
              <button
                onClick={handleRefreshDevices}
                className="btn-ghost p-1.5 sm:p-2"
                aria-label="Refresh devices"
                title="Refresh Devices"
              >
                <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                className="btn-ghost p-1.5 sm:p-2"
                aria-label="Settings"
                title="Settings"
              >
                <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={logout}
                className="btn-ghost text-xs sm:text-sm px-2.5 sm:px-4 py-1.5 sm:py-2"
                aria-label="Logout"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Connection Status */}
        <div className="mb-4 sm:mb-8">
          <ConnectionStatus
            isConnected={isConnected}
            deviceCount={devices.length}
            devices={devices}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="card lg:sticky lg:top-6">
              <DeviceSelector
                devices={devices}
                selectedDeviceId={selectedDeviceId}
                onSelectDevice={setSelectedDeviceId}
                onOpenProvisioning={() => setIsProvisioningOpen(true)}
              />
            </div>
          </div>

          {/* Main Panel */}
          <div className="lg:col-span-2 flex flex-col min-w-0">
            {/* Tabs Navigation */}
            <div className="flex border-b border-border mb-4 sm:mb-6 overflow-x-auto whitespace-nowrap no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
              <button
                onClick={() => setActiveTab('monitor')}
                className={`py-2.5 px-3 sm:px-5 font-medium text-xs sm:text-sm transition-all border-b-2 -mb-[2px] flex items-center gap-1.5 sm:gap-2 shrink-0 ${
                  activeTab === 'monitor'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-foreground/60 hover:text-foreground hover:border-border'
                }`}
              >
                <Tv className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                Remote & Screen
              </button>
              <button
                onClick={() => setActiveTab('files')}
                className={`py-2.5 px-3 sm:px-5 font-medium text-xs sm:text-sm transition-all border-b-2 -mb-[2px] flex items-center gap-1.5 sm:gap-2 shrink-0 ${
                  activeTab === 'files'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-foreground/60 hover:text-foreground hover:border-border'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                File Manager
              </button>
              <button
                onClick={() => setActiveTab('terminal')}
                className={`py-2.5 px-3 sm:px-5 font-medium text-xs sm:text-sm transition-all border-b-2 -mb-[2px] flex items-center gap-1.5 sm:gap-2 shrink-0 ${
                  activeTab === 'terminal'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-foreground/60 hover:text-foreground hover:border-border'
                }`}
              >
                <TerminalIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                Terminal
              </button>
              <button
                onClick={() => setActiveTab('commands')}
                className={`py-2.5 px-3 sm:px-5 font-medium text-xs sm:text-sm transition-all border-b-2 -mb-[2px] flex items-center gap-1.5 sm:gap-2 shrink-0 ${
                  activeTab === 'commands'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-foreground/60 hover:text-foreground hover:border-border'
                }`}
              >
                <Cpu className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                Commands & Output
              </button>
            </div>

            {/* Tab Panes */}
            <div className="space-y-4 sm:space-y-6">
              <div className={activeTab === 'monitor' ? '' : 'hidden'}>
                <RemoteMonitor socket={socket} device={selectedDevice} />
              </div>
              
              <div className={activeTab === 'files' ? '' : 'hidden'}>
                <FileManager socket={socket} device={selectedDevice} />
              </div>
              
              <div className={activeTab === 'terminal' ? '' : 'hidden'}>
                <Terminal socket={socket} device={selectedDevice} />
              </div>
              
              <div className={activeTab === 'commands' ? 'space-y-4 sm:space-y-6' : 'hidden'}>
                {/* Commands Section */}
                <section className="bg-input border border-border rounded-lg p-4 sm:p-6">
                  <h2 className="text-lg sm:text-xl font-bold text-foreground mb-3 sm:mb-4">
                    Available Commands
                  </h2>
                  <CommandGrid
                    deviceId={selectedDeviceId}
                    socket={socket}
                    onCommandExecute={handleCommandExecute}
                  />
                </section>

                {/* Response Section */}
                <section className="bg-input border border-border rounded-lg p-4 sm:p-6">
                  <h2 className="text-lg sm:text-xl font-bold text-foreground mb-3 sm:mb-4">
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
      <footer className="border-t border-border bg-input mt-8 sm:mt-16">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 text-center text-xs sm:text-sm text-foreground/60">
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

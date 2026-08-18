'use client';

import { Socket } from 'socket.io-client';
import { CommandButton } from './CommandButton';
import { DEVICE_COMMANDS, CommandExecutionState } from '@/lib/types';

interface CommandGridProps {
  deviceId: string | null;
  socket: Socket | null;
  onCommandExecute: (state: CommandExecutionState) => void;
}

const categoryIcons = {
  APP: '📱',
  DEVICE: '🖥️',
  NETWORK: '🌐',
  TAILSCALE: '🔗',
  HEALTH: '❤️',
  SECURITY: '🛡️',
  DIAGNOSTICS: '🛠️',
};

export const CommandGrid = ({
  deviceId,
  socket,
  onCommandExecute,
}: CommandGridProps) => {
  return (
    <div className="space-y-6">
      {Object.entries(DEVICE_COMMANDS).map(([category, commands]) => (
        <div key={category} className="card">
          <h3 className="text-lg font-semibold mb-4 text-foreground flex items-center gap-2">
            <span>{categoryIcons[category as keyof typeof categoryIcons]}</span>
            {category}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {commands.map((cmd) => (
              <CommandButton
                key={cmd.id}
                commandId={cmd.id}
                label={cmd.label}
                deviceId={deviceId}
                socket={socket}
                onExecute={onCommandExecute}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

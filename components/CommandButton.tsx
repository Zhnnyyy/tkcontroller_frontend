'use client';

import { useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { CommandExecutionState } from '@/lib/types';

interface CommandButtonProps {
  commandId: string;
  label: string;
  deviceId: string | null;
  socket: Socket | null;
  onExecute: (state: CommandExecutionState) => void;
}

export const CommandButton = ({
  commandId,
  label,
  deviceId,
  socket,
  onExecute,
}: CommandButtonProps) => {
  const [state, setState] = useState<CommandExecutionState>({
    command: commandId,
    status: 'idle',
  });

  const handleClick = async () => {
    if (!socket || !deviceId) return;

    setState({ command: commandId, status: 'loading' });

    try {
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Command execution timeout'));
        }, 30000);

        socket.emit('send_command', { device_id: deviceId, command: commandId }, (response: any) => {
          clearTimeout(timeout);
          resolve(response);
        });
      });

      const newState: CommandExecutionState = {
        command: commandId,
        status: 'success',
        response: response as any,
        timestamp: new Date().toISOString(),
      };
      setState(newState);
      onExecute(newState);
    } catch (error) {
      const newState: CommandExecutionState = {
        command: commandId,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
      setState(newState);
      onExecute(newState);
    }
  };

  const isDisabled = !socket || !deviceId || state.status === 'loading';
  const isError = state.status === 'error';
  const isSuccess = state.status === 'success';

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        relative w-full px-4 py-3 rounded-lg font-medium text-sm
        transition-all duration-200 flex items-center justify-center gap-2
        ${
          isError
            ? 'bg-error text-primary-foreground hover:opacity-90'
            : isSuccess
            ? 'bg-success text-primary-foreground hover:opacity-90'
            : 'bg-primary text-primary-foreground hover:opacity-90'
        }
        ${isDisabled && !isError && !isSuccess ? 'opacity-50 cursor-not-allowed' : ''}
        border border-border
      `}
    >
      {state.status === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
      {state.status === 'error' && <AlertCircle className="w-4 h-4" />}
      {state.status === 'success' && <CheckCircle2 className="w-4 h-4" />}
      <span>{label}</span>
    </button>
  );
};

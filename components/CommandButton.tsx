'use client';

import { useMemo, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { CommandExecutionState } from '@/lib/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { COMMAND_PAYLOAD_FIELDS } from '@/lib/command-payloads';

const TIMEKEEPING_DOWNLOAD_URL =
  'https://www.dropbox.com/scl/fi/hv60dph84vg7aafzdx4uv/STimekeeping.apk?rlkey=fxkcn2tuaqlywvquavw5p182t&st=n0lhoky1&dl=1';

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const payloadFields = COMMAND_PAYLOAD_FIELDS[commandId] || [];
  const [payloadValues, setPayloadValues] = useState<Record<string, string>>({});

  const isPayloadValid = useMemo(
    () =>
      payloadFields.every((field) =>
        field.required ? (payloadValues[field.key] || '').trim().length > 0 : true
      ),
    [payloadFields, payloadValues]
  );

  const executeCommand = async () => {
    if (!socket || !deviceId) return;

    const localCommandId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    let progressHandler: ((progress: any) => void) | null = null;
    const initialState: CommandExecutionState = {
      command: commandId,
      commandId: localCommandId,
      status: 'loading',
      response: {
        success: false,
        message: 'Command started',
        data: { command_id: localCommandId, stage: 'queued', percent: 0 },
      },
      timestamp: new Date().toISOString(),
    };
    setState(initialState);
    onExecute(initialState);

    try {
      progressHandler = (progress: any) => {
        if (
          progress?.command_id !== localCommandId ||
          progress?.device_id !== deviceId ||
          progress?.command !== commandId
        ) {
          return;
        }
        const progressState: CommandExecutionState = {
          command: commandId,
          commandId: localCommandId,
          status: 'loading',
          response: {
            success: false,
            message: progress?.message || 'In progress',
            data: progress,
          } as any,
          timestamp: new Date().toISOString(),
        };
        setState(progressState);
        onExecute(progressState);
      };
      socket.on('command_progress', progressHandler);

      const response = await new Promise((resolve, reject) => {
        const timeoutMs =
          commandId === 'install_lbrdc_service' || commandId === 'install_magisk_module'
            ? 180000
            : 30000;
        const timeout = setTimeout(() => {
          if (progressHandler) {
            socket.off('command_progress', progressHandler);
          }
          reject(new Error('Command execution timeout'));
        }, timeoutMs);

        const payload =
          payloadFields.length === 0
            ? undefined
            : payloadFields.reduce<Record<string, string>>((acc, field) => {
                const value = (payloadValues[field.key] || '').trim();
                if (value.length > 0) {
                  acc[field.key] = value;
                }
                return acc;
              }, {});

        socket.emit(
          'send_command',
          { deviceId, device_id: deviceId, command: commandId, command_id: localCommandId, payload },
          (response: any) => {
            clearTimeout(timeout);
            if (progressHandler) {
              socket.off('command_progress', progressHandler);
            }
            resolve(response);
          }
        );
      });

      const newState: CommandExecutionState = {
        command: commandId,
        commandId: (response as any)?.command_id || localCommandId,
        status: 'success',
        response: response as any,
        timestamp: new Date().toISOString(),
      };
      setState(newState);
      onExecute(newState);
    } catch (error) {
      if (progressHandler) {
        socket.off('command_progress', progressHandler);
      }
      const newState: CommandExecutionState = {
        command: commandId,
        commandId: localCommandId,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
      setState(newState);
      onExecute(newState);
    }
  };

  const handleClick = () => {
    if (!socket || !deviceId || state.status === 'loading') return;
    if (payloadFields.length > 0) {
      const initialPayload = payloadFields.reduce<Record<string, string>>((acc, field) => {
        if (commandId === 'update_timekeeping' && field.key === 'download_url') {
          acc[field.key] = TIMEKEEPING_DOWNLOAD_URL;
        } else {
          acc[field.key] = '';
        }
        return acc;
      }, {});
      setPayloadValues(initialPayload);
    }
    setConfirmOpen(true);
  };

  const isDisabled = !socket || !deviceId || state.status === 'loading';
  const isError = state.status === 'error';
  const isSuccess = state.status === 'success';

  return (
    <>
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
      <ConfirmDialog
        open={confirmOpen}
        title={payloadFields.length > 0 ? label : 'Confirm Command'}
        description={
          payloadFields.length > 0
            ? `Provide required details for "${label}" on device ${deviceId}.`
            : `Execute "${label}" on device ${deviceId}?`
        }
        confirmLabel={payloadFields.length > 0 ? 'Run Command' : 'Confirm'}
        cancelLabel="Cancel"
        confirmDisabled={payloadFields.length > 0 ? !isPayloadValid : false}
        onConfirm={() => {
          setConfirmOpen(false);
          executeCommand();
        }}
        onCancel={() => setConfirmOpen(false)}
      >
        {payloadFields.length > 0 && (
          <div className="space-y-3">
            {payloadFields.map((field) => (
              <label key={field.key} className="block">
                <span className="text-sm font-medium text-foreground">
                  {field.label}
                  {field.required ? ' *' : ''}
                </span>
                <input
                  type={field.type || 'text'}
                  value={payloadValues[field.key] || ''}
                  onChange={(event) =>
                    setPayloadValues((prev) => ({
                      ...prev,
                      [field.key]: event.target.value,
                    }))
                  }
                  placeholder={field.placeholder}
                  className="mt-2 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {field.helper && (
                  <span className="mt-1 block text-xs text-foreground/60">
                    {field.helper}
                  </span>
                )}
              </label>
            ))}
          </div>
        )}
      </ConfirmDialog>
    </>
  );
};

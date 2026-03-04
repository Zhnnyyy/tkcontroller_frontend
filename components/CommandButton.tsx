'use client';

import { useMemo, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Socket } from 'socket.io-client';
import { CommandExecutionState } from '@/lib/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { COMMAND_PAYLOAD_FIELDS } from '@/lib/command-payloads';

const TIMEKEEPING_OWNER = 'Zhnnyyy';
const TIMEKEEPING_REPO = 'STimekeeping';
const TIMEKEEPING_APK = 'STimekeeping.apk';

const buildTimekeepingDownloadUrl = () =>
  `https://github.com/${TIMEKEEPING_OWNER}/${TIMEKEEPING_REPO}/releases/latest/download/${TIMEKEEPING_APK}`;

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

    setState({ command: commandId, status: 'loading' });

    try {
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Command execution timeout'));
        }, 30000);

        const payload =
          payloadFields.length === 0
            ? undefined
            : commandId === 'update_timekeeping'
            ? {
                download_url: buildTimekeepingDownloadUrl(),
                github_pat: (payloadValues.github_pat || '').trim(),
              }
            : payloadFields.reduce<Record<string, string>>((acc, field) => {
                const value = (payloadValues[field.key] || '').trim();
                if (value.length > 0) {
                  acc[field.key] = value;
                }
                return acc;
              }, {});

        socket.emit(
          'send_command',
          { deviceId, device_id: deviceId, command: commandId, payload },
          (response: any) => {
          clearTimeout(timeout);
          resolve(response);
          }
        );
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

  const handleClick = () => {
    if (!socket || !deviceId || state.status === 'loading') return;
    if (payloadFields.length > 0) {
      const initialPayload = payloadFields.reduce<Record<string, string>>((acc, field) => {
        acc[field.key] = '';
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

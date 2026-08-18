'use client';

import { CommandExecutionState } from '@/lib/types';
import { X, Copy, Download } from 'lucide-react';
import { useState } from 'react';

interface ResponseDisplayProps {
  state: CommandExecutionState | null;
  onClear: () => void;
}

export const ResponseDisplay = ({ state, onClear }: ResponseDisplayProps) => {
  const [copied, setCopied] = useState(false);

  if (!state) {
    return (
      <div className="card border-dashed min-h-64 flex items-center justify-center">
        <div className="text-center">
          <p className="text-foreground/50 font-medium">
            Execute a command to see the response here
          </p>
        </div>
      </div>
    );
  }

  const responseText = JSON.stringify(state.response || state.error, null, 2);
  const progressPayload =
    (state.response as any)?.data ||
    (state.response as any)?.response ||
    null;
  const progressPercentRaw =
    progressPayload?.percent ??
    progressPayload?.download_percent ??
    null;
  const progressPercent =
    typeof progressPercentRaw === 'number'
      ? Math.max(0, Math.min(100, progressPercentRaw))
      : null;
  const progressStage = progressPayload?.stage;

  const handleCopy = () => {
    navigator.clipboard.writeText(responseText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([responseText], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `response-${state.command}-${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Response</h3>
          <p className="text-sm text-foreground/60 mt-1">
            Command: <span className="font-mono font-medium">{state.command}</span>
          </p>
        </div>
        <button
          onClick={onClear}
          className="p-2 hover:bg-input rounded-lg transition-colors"
          aria-label="Clear response"
        >
          <X className="w-5 h-5 text-foreground/50 hover:text-foreground" />
        </button>
      </div>

      <div className="mb-4">
        <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
          state.status === 'success'
            ? 'bg-success/20 text-success'
            : state.status === 'error'
            ? 'bg-error/20 text-error'
            : 'bg-warning/20 text-warning'
        }`}>
          {state.status.charAt(0).toUpperCase() + state.status.slice(1)}
        </div>
      </div>

      {progressPercent !== null && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-foreground/70 mb-2">
            <span>{progressStage ? String(progressStage) : 'progress'}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 bg-input rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {state.command === 'capture_screenshot' && (state.response as any)?.response?.image && (
        <div className="mb-4 bg-background border border-border rounded-lg p-2 flex justify-center">
          <img
            src={`data:image/png;base64,${(state.response as any).response.image}`}
            alt="Screenshot"
            className="max-h-96 object-contain rounded-md"
          />
        </div>
      )}

      <div className="bg-background border border-border rounded-lg p-4 mb-4 overflow-auto max-h-96">
        <pre className="text-sm text-foreground/80 font-mono whitespace-pre-wrap break-words">
          {responseText}
        </pre>
      </div>

      {state.timestamp && (
        <p className="text-xs text-foreground/50 mb-4">
          Executed at {new Date(state.timestamp).toLocaleTimeString()}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className="flex-1 btn-secondary flex items-center justify-center gap-2"
        >
          <Copy className="w-4 h-4" />
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button
          onClick={handleDownload}
          className="flex-1 btn-secondary flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download
        </button>
      </div>
    </div>
  );
};

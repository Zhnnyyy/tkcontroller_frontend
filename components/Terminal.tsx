'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { Terminal as TerminalIcon, Play, RefreshCw, Trash2, ArrowRight } from 'lucide-react';
import { Device } from '@/lib/types';

interface TerminalProps {
  socket: Socket | null;
  device: Device | null;
}

interface HistoryLine {
  type: 'input' | 'output' | 'error' | 'info';
  text: string;
}

export function Terminal({ socket, device }: TerminalProps) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<HistoryLine[]>([
    { type: 'info', text: 'Interactive Android Shell initialized.' },
    { type: 'info', text: 'Commands are executed as root (su).' },
  ]);
  const [loading, setLoading] = useState(false);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const outputEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  useEffect(() => {
    if (device?.device_id) {
      setHistory([
        { type: 'info', text: `Session started for device: ${device.device_name} (${device.device_id})` },
        { type: 'info', text: 'Commands are executed as root (su).' },
      ]);
      setCmdHistory([]);
      setHistoryIndex(-1);
      setInput('');
    }
  }, [device?.device_id, device?.device_name]);

  const handleExecute = async (cmdToSend = input) => {
    const trimmed = cmdToSend.trim();
    if (!trimmed || !socket || !device?.device_id || loading) return;

    setHistory((prev) => [...prev, { type: 'input', text: trimmed }]);
    setLoading(true);
    setInput('');
    setHistoryIndex(-1);

    // Save to local command history
    setCmdHistory((prev) => {
      const filtered = prev.filter((cmd) => cmd !== trimmed);
      return [...filtered, trimmed];
    });

    const localCommandId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    socket.emit(
      'send_command',
      {
        deviceId: device.device_id,
        device_id: device.device_id,
        command: 'run_shell',
        command_id: localCommandId,
        payload: { command: trimmed },
      },
      (response: any) => {
        setLoading(false);
        const devResp = response?.response;
        if (devResp?.status === 'success') {
          const exitCode = devResp.exit_code ?? 0;
          const output = devResp.output || '';
          
          if (output) {
            setHistory((prev) => [...prev, { type: 'output', text: output }]);
          }
          
          if (exitCode !== 0) {
            setHistory((prev) => [...prev, { type: 'error', text: `Process exited with code ${exitCode}` }]);
          }
        } else {
          setHistory((prev) => [
            ...prev,
            { type: 'error', text: devResp?.message || response?.message || 'Execution failed' },
          ]);
        }
        // Return focus to input
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleExecute();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length === 0) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex < cmdHistory.length) {
        setHistoryIndex(nextIndex);
        setInput(cmdHistory[cmdHistory.length - 1 - nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = historyIndex - 1;
      if (nextIndex >= 0) {
        setHistoryIndex(nextIndex);
        setInput(cmdHistory[cmdHistory.length - 1 - nextIndex]);
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  const clearHistory = () => {
    setHistory([
      { type: 'info', text: 'Terminal history cleared.' },
    ]);
  };

  if (!device) {
    return (
      <div className="card min-h-64 flex items-center justify-center border-dashed">
        <p className="text-foreground/50 font-medium">Select a device to open terminal</p>
      </div>
    );
  }

  return (
    <div className="card flex flex-col h-[450px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Interactive Terminal</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="p-1.5 hover:bg-input rounded-lg text-foreground/50 hover:text-foreground transition-colors"
            onClick={clearHistory}
            title="Clear Output"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal Screen */}
      <div 
        className="flex-1 bg-black border border-border/80 rounded-lg p-4 font-mono text-xs overflow-y-auto text-green-400 space-y-2 select-text"
        onClick={() => inputRef.current?.focus()}
      >
        {history.map((line, idx) => {
          if (line.type === 'input') {
            return (
              <div key={idx} className="flex items-start gap-1">
                <span className="text-blue-400 select-none">root@android:#</span>
                <span className="text-white font-semibold whitespace-pre-wrap">{line.text}</span>
              </div>
            );
          } else if (line.type === 'error') {
            return (
              <div key={idx} className="text-red-400 whitespace-pre-wrap">
                {line.text}
              </div>
            );
          } else if (line.type === 'info') {
            return (
              <div key={idx} className="text-gray-500 italic select-none">
                [info] {line.text}
              </div>
            );
          } else {
            return (
              <div key={idx} className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                {line.text}
              </div>
            );
          }
        })}
        {loading && (
          <div className="flex items-center gap-2 text-gray-500 animate-pulse select-none">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Executing...</span>
          </div>
        )}
        <div ref={outputEndRef} />
      </div>

      {/* Input Prompt bar */}
      <div className="flex items-center gap-2 mt-3 bg-input rounded-lg border border-border px-3 py-2">
        <span className="text-xs font-mono text-blue-400 font-bold select-none">#</span>
        <input
          type="text"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder="Type shell command..."
          className="flex-1 bg-transparent border-0 outline-none text-xs font-mono text-foreground focus:ring-0 p-0"
        />
        <button
          type="button"
          onClick={() => handleExecute()}
          disabled={loading || !input.trim()}
          className="p-1 hover:bg-background rounded text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Send"
        >
          <Play className="w-4 h-4 fill-current" />
        </button>
      </div>
    </div>
  );
}

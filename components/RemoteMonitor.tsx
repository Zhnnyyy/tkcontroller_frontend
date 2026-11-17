'use client';

import { PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { Device } from '@/lib/types';
import {
  Shield,
  Server,
  Key,
  Lock,
  ExternalLink,
  Copy,
  Check,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Play,
  Square,
  Maximize2,
  Minimize2,
  Tv,
} from 'lucide-react';

type SessionState = 'idle' | 'connecting' | 'connected' | 'error' | 'ended';

type ScreenInfo = {
  width: number;
  height: number;
};

function createSessionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface RemoteMonitorProps {
  socket: Socket | null;
  device: Device | null;
}

export function RemoteMonitor({ socket, device }: RemoteMonitorProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const monitorContainerRef = useRef<HTMLDivElement | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; at: number } | null>(null);

  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [statusMessage, setStatusMessage] = useState('Remote stream inactive');
  const [screenInfo, setScreenInfo] = useState<ScreenInfo | null>(null);
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Provisioning form state
  const [server, setServer] = useState('lbrdc-software.com:21116');
  const [relay, setRelay] = useState('lbrdc-software.com:21117');
  const [key, setKey] = useState('uHinkRyReE2WYB5SjKrDr3n6D2KOs1ZBvb+1pcAUYNI=');
  const [password, setPassword] = useState('Lbrdc2021.');
  const [showPassword, setShowPassword] = useState(false);
  const [provStatus, setProvStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [provMessage, setProvMessage] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const rustdeskId = device?.rustdesk_id || device?.zhentinel_id;
  const isHostRunning = device?.zhentinel_status === 'running' || Boolean(rustdeskId);

  useEffect(() => {
    if (device) {
      if (device.zhentinel_server) setServer(device.zhentinel_server);
      if (device.zhentinel_relay) setRelay(device.zhentinel_relay);
      if (device.zhentinel_key) setKey(device.zhentinel_key);
      if (device.zhentinel_password) setPassword(device.zhentinel_password);
    }
    if (typeof window !== 'undefined' && device?.device_id) {
      try {
        const cached = localStorage.getItem(`zhentinel_prov_${device.device_id}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.server && !device?.zhentinel_server) setServer(parsed.server);
          if (parsed.relay && !device?.zhentinel_relay) setRelay(parsed.relay);
          if (parsed.key && !device?.zhentinel_key) setKey(parsed.key);
          if (parsed.password && !device?.zhentinel_password) setPassword(parsed.password);
        }
      } catch (ignored) {}
    }
  }, [device]);

  // Socket frame preview listener
  useEffect(() => {
    if (!socket) return;

    const handleFrame = (data: any) => {
      if (data?.session_id !== sessionIdRef.current) return;
      const frame = data?.frame;
      if (!frame?.image) return;

      const mimeType = frame?.mime_type || 'image/png';
      setFrameSrc(`data:${mimeType};base64,${frame.image}`);
      setSessionState('connected');
      setStatusMessage('Live preview active');

      const width = Number(frame?.width) || 0;
      const height = Number(frame?.height) || 0;
      if (width > 0 && height > 0) {
        setScreenInfo({ width, height });
      }
    };

    const handleInfo = (data: any) => {
      if (data?.session_id !== sessionIdRef.current) return;
      const screen = data?.info?.screen;
      if (screen) {
        setScreenInfo({
          width: Number(screen.width) || 0,
          height: Number(screen.height) || 0,
        });
      }
    };

    const handleState = (data: any) => {
      if (data?.session_id !== sessionIdRef.current) return;
      const state = String(data?.state || '').toLowerCase();
      const message = data?.message || 'Stream state updated';
      setStatusMessage(message);

      if (state === 'connected' || state === 'connecting') {
        setSessionState(state as SessionState);
      } else {
        setSessionState(state === 'error' ? 'error' : 'ended');
      }
    };

    socket.on('monitor_frame', handleFrame);
    socket.on('monitor_info', handleInfo);
    socket.on('monitor_state', handleState);

    return () => {
      socket.off('monitor_frame', handleFrame);
      socket.off('monitor_info', handleInfo);
      socket.off('monitor_state', handleState);
    };
  }, [socket]);

  const handleStartSocketPreview = () => {
    if (!socket || !device) return;
    const sessionId = createSessionId();
    sessionIdRef.current = sessionId;
    setSessionState('connecting');
    setStatusMessage('Requesting socket preview...');

    socket.emit(
      'monitor_start',
      {
        session_id: sessionId,
        device_id: device.device_id,
        fps: 10,
        scale: 0.5,
        quality: 60,
      },
      (res: any) => {
        if (res?.status === 'error') {
          setSessionState('error');
          setStatusMessage(res.message || 'Failed to start socket preview');
        }
      }
    );
  };

  const handleStopSocketPreview = () => {
    if (socket && sessionIdRef.current && device) {
      socket.emit('monitor_stop', {
        session_id: sessionIdRef.current,
        device_id: device.device_id,
      });
    }
    sessionIdRef.current = null;
    setSessionState('idle');
    setFrameSrc(null);
    setStatusMessage('Remote stream inactive');
  };

  const handleCopyId = () => {
    if (rustdeskId) {
      navigator.clipboard.writeText(rustdeskId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConnectRustDesk = () => {
    if (rustdeskId) {
      window.location.href = `rustdesk://${rustdeskId}`;
    }
  };

  const handleRestartZhentinel = async () => {
    if (!socket || !device) return;
    setActionLoading('restart');
    try {
      await new Promise((resolve) => {
        socket.emit(
          'send_command',
          {
            deviceId: device.device_id,
            device_id: device.device_id,
            command: 'restart_zhentinel',
          },
          (res: any) => {
            resolve(res);
          }
        );
      });
      setStatusMessage('Zhentinel Host restarted');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCheckStatus = async () => {
    if (!socket || !device) return;
    setActionLoading('check');
    try {
      await new Promise((resolve) => {
        socket.emit(
          'send_command',
          {
            deviceId: device.device_id,
            device_id: device.device_id,
            command: 'check_zhentinel_status',
          },
          (res: any) => {
            resolve(res);
          }
        );
      });
      setStatusMessage('Status refreshed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleProvisioningSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !device) return;

    if (!server.trim()) {
      setProvStatus('error');
      setProvMessage('Server address is required');
      return;
    }
    if (!key.trim()) {
      setProvStatus('error');
      setProvMessage('Public key is required');
      return;
    }
    if (password.length < 8) {
      setProvStatus('error');
      setProvMessage('Password must be at least 8 characters');
      return;
    }

    setProvStatus('loading');
    setProvMessage('Writing provisioning.json and restarting Zhentinel host...');

    const payload = {
      server: server.trim(),
      relay: relay.trim(),
      key: key.trim(),
      password,
    };

    try {
      const response: any = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Provisioning command timed out after 25s'));
        }, 25000);

        socket.emit(
          'send_command',
          {
            deviceId: device.device_id,
            device_id: device.device_id,
            command: 'update_remote_provisioning',
            payload,
          },
          (res: any) => {
            clearTimeout(timeout);
            resolve(res);
          }
        );
      });

      const result = response?.response || response;
      if (result?.status === 'success' || response?.status === 'success') {
        if (typeof window !== 'undefined' && device?.device_id) {
          try {
            localStorage.setItem(`zhentinel_prov_${device.device_id}`, JSON.stringify(payload));
          } catch (ignored) {}
        }
        setProvStatus('success');
        setProvMessage(result?.message || 'Credentials successfully updated and host restarted!');
        setTimeout(() => {
          setProvStatus('idle');
          setProvMessage('');
        }, 4000);
      } else {
        setProvStatus('error');
        setProvMessage(result?.message || response?.message || 'Failed to update remote credentials');
      }
    } catch (err: any) {
      setProvStatus('error');
      setProvMessage(err.message || 'Error executing provisioning update');
    }
  };

  // Touch control helper for socket preview
  const sendControl = (action: string, payload: Record<string, any>) => {
    if (!socket || !device || !sessionIdRef.current) return;
    socket.emit('monitor_control', {
      session_id: sessionIdRef.current,
      device_id: device.device_id,
      action,
      ...payload,
    });
  };

  const getRelativeCoords = (event: ReactPointerEvent<HTMLImageElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const scaleX = (screenInfo?.width || 1200) / rect.width;
    const scaleY = (screenInfo?.height || 2000) / rect.height;
    return {
      x: Math.round(x * scaleX),
      y: Math.round(y * scaleY),
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLImageElement>) => {
    const coords = getRelativeCoords(event);
    if (!coords) return;
    pointerStartRef.current = { ...coords, at: Date.now() };
    sendControl('down', coords);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLImageElement>) => {
    const coords = getRelativeCoords(event);
    if (!coords) return;
    const start = pointerStartRef.current;
    pointerStartRef.current = null;

    if (start) {
      const distance = Math.hypot(coords.x - start.x, coords.y - start.y);
      const duration = Date.now() - start.at;
      if (distance < 15 && duration < 350) {
        sendControl('click', coords);
        return;
      }
    }
    sendControl('up', coords);
  };

  if (!device) {
    return (
      <div className="card p-6 sm:p-8 text-center text-foreground/60 text-sm">
        Please select a device from the sidebar to view remote controls.
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Zhentinel Remote Hub Card */}
      <div className="card border-primary/30 bg-input p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-border">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-primary/10 border border-primary/30 text-primary shrink-0">
              <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-bold flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span>Zhentinel Remote Control</span>
                <span
                  className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                    isHostRunning
                      ? 'bg-success/20 text-success border border-success/30'
                      : 'bg-foreground/10 text-foreground/60'
                  }`}
                >
                  {isHostRunning ? '● Host Active' : '● Host Stopped'}
                </span>
              </h2>
              <p className="text-[11px] sm:text-xs text-foreground/60 mt-0.5 truncate">
                Headless zero-click RustDesk service on {device.device_name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleCheckStatus}
              disabled={Boolean(actionLoading)}
              className="btn-ghost flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-xs py-1.5 sm:py-2 px-2.5 sm:px-3"
              title="Refresh Remote Host Status"
            >
              {actionLoading === 'check' ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              ) : (
                <RotateCcw className="w-4 h-4 text-foreground/70" />
              )}
              <span>Check Status</span>
            </button>
            <button
              onClick={handleRestartZhentinel}
              disabled={Boolean(actionLoading)}
              className="btn-ghost flex-1 sm:flex-initial flex items-center justify-center gap-1.5 text-xs py-1.5 sm:py-2 px-2.5 sm:px-3 text-warning hover:text-warning"
              title="Restart Zhentinel Host Service"
            >
              {actionLoading === 'restart' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
              <span>Restart Host</span>
            </button>
          </div>
        </div>

        {/* Remote ID & Quick Launch */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div className="p-3 sm:p-4 rounded-xl bg-background border border-border space-y-2">
            <span className="text-[11px] sm:text-xs font-semibold text-foreground/70 uppercase tracking-wider">
              RustDesk Device ID
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xl sm:text-2xl font-bold text-primary tracking-wide truncate">
                {rustdeskId || '1408621429'}
              </span>
              <button
                onClick={handleCopyId}
                className="p-1.5 sm:p-2 rounded-lg border border-border hover:bg-white/10 text-foreground/70 hover:text-foreground transition-colors flex items-center gap-1.5 text-xs font-medium shrink-0"
              >
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied' : 'Copy ID'}</span>
              </button>
            </div>
            <p className="text-[10px] sm:text-[11px] text-foreground/50">
              Direct remote identifier for desktop RustDesk client connections.
            </p>
          </div>

          <div className="p-3 sm:p-4 rounded-xl bg-background border border-border flex flex-col justify-between space-y-2.5 sm:space-y-2">
            <div>
              <span className="text-[11px] sm:text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                1-Click Connection
              </span>
              <p className="text-xs text-foreground/60 mt-0.5 sm:mt-1">
                Launches your local RustDesk application directly to this kiosk tablet.
              </p>
            </div>
            <button
              onClick={handleConnectRustDesk}
              className="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-xs sm:text-sm hover:opacity-90 flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Connect via RustDesk</span>
            </button>
          </div>
        </div>
      </div>

      {/* Provisioning Credentials Form */}
      <div className="card bg-input p-4 sm:p-6 space-y-3 sm:space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 sm:pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
            <h3 className="text-base sm:text-lg font-bold">Remote Provisioning Credentials</h3>
          </div>
          <span className="text-xs text-foreground/50 font-mono">provisioning.json</span>
        </div>

        <p className="text-xs text-foreground/70">
          Update the private rendezvous server, relay, public key, and permanent password. Pushing
          credentials will deploy `provisioning.json` with root permissions and restart the host
          service automatically.
        </p>

        <form onSubmit={handleProvisioningSubmit} className="space-y-3 sm:space-y-4 pt-1 sm:pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5 text-foreground/90">
                <Server className="w-3.5 h-3.5 text-primary" /> Rendezvous Server
              </label>
              <input
                type="text"
                value={server}
                onChange={(e) => setServer(e.target.value)}
                placeholder="e.g. lbrdc-software.com:21116"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5 text-foreground/90">
                <Server className="w-3.5 h-3.5 text-primary/70" /> Relay Server
              </label>
              <input
                type="text"
                value={relay}
                onChange={(e) => setRelay(e.target.value)}
                placeholder="e.g. lbrdc-software.com:21117"
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 flex items-center gap-1.5 text-foreground/90">
              <Key className="w-3.5 h-3.5 text-primary" /> Server Public Key
            </label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Server public key base64"
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary font-mono text-[11px] sm:text-xs"
              required
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold flex items-center gap-1.5 text-foreground/90">
                <Lock className="w-3.5 h-3.5 text-primary" /> Permanent Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-primary hover:underline"
              >
                {showPassword ? 'Hide Password' : 'Show Password'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              required
            />
          </div>

          {provMessage && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                provStatus === 'success'
                  ? 'bg-success/15 border border-success/30 text-success'
                  : provStatus === 'error'
                  ? 'bg-error/15 border border-error/30 text-error'
                  : 'bg-primary/10 border border-primary/20 text-foreground'
              }`}
            >
              {provStatus === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              {provStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-success" />}
              {provStatus === 'error' && <AlertCircle className="w-4 h-4 text-error" />}
              <span>{provMessage}</span>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={provStatus === 'loading'}
              className="w-full sm:w-auto py-2.5 px-6 rounded-lg bg-primary text-primary-foreground font-semibold text-xs sm:text-sm hover:opacity-90 flex items-center justify-center gap-2 transition-all shadow-md"
            >
              {provStatus === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Push Provisioning & Restart Host</span>
            </button>
          </div>
        </form>
      </div>

      {/* Browser Snapshot Preview (Pure Socket JPEG Mirror, No WebRTC) */}
      <div className="card bg-input p-4 sm:p-6 space-y-3 sm:space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2.5 sm:pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Tv className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
            <h3 className="text-base sm:text-lg font-bold">In-Browser Screen Preview</h3>
            <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded bg-background border border-border text-foreground/60 shrink-0">
              Socket Fallback
            </span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {sessionState === 'connected' ? (
              <button
                onClick={handleStopSocketPreview}
                className="flex-1 sm:flex-initial py-1.5 px-3 rounded-lg bg-error text-primary-foreground text-xs font-medium hover:opacity-90 flex items-center justify-center gap-1.5 transition-all"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop Preview</span>
              </button>
            ) : (
              <button
                onClick={handleStartSocketPreview}
                disabled={sessionState === 'connecting'}
                className="flex-1 sm:flex-initial py-1.5 px-3 rounded-lg border border-border hover:bg-white/10 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
              >
                {sessionState === 'connecting' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                ) : (
                  <Play className="w-3.5 h-3.5 text-success" />
                )}
                <span>Start Browser Preview</span>
              </button>
            )}
            {frameSrc && (
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1.5 rounded-lg border border-border hover:bg-white/10 text-foreground/70 shrink-0"
                title="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        <div
          ref={monitorContainerRef}
          className={`relative rounded-xl border border-border bg-black/80 overflow-hidden flex items-center justify-center min-h-[240px] sm:min-h-[320px] max-h-[50vh] sm:max-h-[600px] ${
            isFullscreen ? 'fixed inset-2 sm:inset-4 z-50 min-h-0 max-h-none' : ''
          }`}
        >
          {frameSrc ? (
            <img
              ref={imageRef}
              src={frameSrc}
              alt="Remote device screen"
              className="max-h-[50vh] sm:max-h-[600px] w-auto max-w-full object-contain cursor-crosshair select-none touch-none"
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              draggable={false}
            />
          ) : (
            <div className="text-center p-6 sm:p-8 space-y-2 text-foreground/50">
              <Tv className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-foreground/20" />
              <p className="text-xs sm:text-sm font-medium">{statusMessage}</p>
              <p className="text-[11px] sm:text-xs">
                For full 60fps low-latency remote control, launch the RustDesk desktop client above.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

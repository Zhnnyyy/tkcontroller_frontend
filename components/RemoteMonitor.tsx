'use client';

import { PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { Device } from '@/lib/types';
import { useAuth } from '@/components/AuthGate';
import { ConfirmDialog } from '@/components/ConfirmDialog';
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
  Wifi,
  Gauge,
  Users,
  Sparkles,
} from 'lucide-react';

type SessionState = 'idle' | 'connecting' | 'connected' | 'error' | 'ended';
type BandwidthPreset = 'lan' | 'cellular';

interface PresetConfig {
  name: string;
  resolution: string;
  fps: number;
  scale: number;
  quality: number;
  label: string;
  badge: string;
}

const PRESET_CONFIGS: Record<BandwidthPreset, PresetConfig> = {
  lan: {
    name: 'LAN Mode',
    resolution: '1080p',
    fps: 30,
    scale: 1.0,
    quality: 85,
    label: 'LAN Mode (1080p / 30fps)',
    badge: '30 FPS • High Def',
  },
  cellular: {
    name: 'Cellular / Low Bandwidth',
    resolution: '720p',
    fps: 15,
    scale: 0.5,
    quality: 50,
    label: 'Cellular (720p / 15fps)',
    badge: '15 FPS • Low Data',
  },
};

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
  const { session } = useAuth();
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
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [warnSessionOpen, setWarnSessionOpen] = useState(false);

  // Bandwidth & Framerate Preset state
  const [bandwidthPreset, setBandwidthPreset] = useState<BandwidthPreset>('cellular');

  // Provisioning form state
  const [server, setServer] = useState('lbrdc-software.com:21116');
  const [relay, setRelay] = useState('lbrdc-software.com:21117');
  const [key, setKey] = useState('uHinkRyReE2WYB5SjKrDr3n6D2KOs1ZBvb+1pcAUYNI=');
  const [password, setPassword] = useState('Lbrdc2021.');
  const [showPassword, setShowPassword] = useState(false);
  const [provStatus, setProvStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [provMessage, setProvMessage] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [fleetStatus, setFleetStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [fleetMessage, setFleetMessage] = useState('');

  const rustdeskId = device?.rustdesk_id || device?.zhentinel_id;
  const isHostRunning = device?.zhentinel_status === 'running' || Boolean(rustdeskId);
  const sessionInUse = Boolean(device?.session_in_use);
  const sessionOperator = device?.session_operator || 'Another Operator';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPreset = localStorage.getItem('zhentinel_monitor_preset') as BandwidthPreset | null;
      if (savedPreset && (savedPreset === 'lan' || savedPreset === 'cellular')) {
        setBandwidthPreset(savedPreset);
      }
    }
  }, []);

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

  const handleStartSocketPreview = (presetOverride?: BandwidthPreset) => {
    if (!socket || !device) return;
    const activePreset = presetOverride || bandwidthPreset;
    const config = PRESET_CONFIGS[activePreset];
    const sessionId = createSessionId();
    sessionIdRef.current = sessionId;
    setSessionState('connecting');
    setStatusMessage(`Requesting socket preview (${config.resolution} @ ${config.fps}fps)...`);

    socket.emit(
      'monitor_start',
      {
        session_id: sessionId,
        device_id: device.device_id,
        operator: session?.username || 'Operator',
        fps: config.fps,
        scale: config.scale,
        quality: config.quality,
      },
      (res: any) => {
        if (res?.status === 'error') {
          setSessionState('error');
          setStatusMessage(res.message || 'Failed to start socket preview');
        }
      }
    );
  };

  const handleStopSocketPreview = (resetSession = true) => {
    if (socket && sessionIdRef.current && device) {
      socket.emit('monitor_stop', {
        session_id: sessionIdRef.current,
        device_id: device.device_id,
      });
    }
    sessionIdRef.current = null;
    if (resetSession) {
      setSessionState('idle');
      setFrameSrc(null);
      setStatusMessage('Remote stream inactive');
    }
  };

  const handlePresetToggle = (preset: BandwidthPreset) => {
    if (preset === bandwidthPreset) return;
    setBandwidthPreset(preset);
    if (typeof window !== 'undefined') {
      localStorage.setItem('zhentinel_monitor_preset', preset);
    }
    if (sessionState === 'connected' || sessionState === 'connecting') {
      handleStopSocketPreview(false);
      setTimeout(() => {
        handleStartSocketPreview(preset);
      }, 150);
    }
  };

  const handleCopyId = () => {
    if (rustdeskId) {
      navigator.clipboard.writeText(rustdeskId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const executeConnectRustDesk = async () => {
    if (!rustdeskId) return;
    const targetPassword = device?.zhentinel_password || password || 'Lbrdc2021.';
    try {
      await navigator.clipboard.writeText(targetPassword);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 4000);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }

    if (socket && device) {
      socket.emit('operator_session_start', {
        device_id: device.device_id,
        operator: session?.username || 'Operator',
        type: 'rustdesk',
      });
    }

    window.location.href = `rustdesk://${rustdeskId}`;
  };

  const handleConnectRustDesk = () => {
    if (sessionInUse) {
      setWarnSessionOpen(true);
    } else {
      executeConnectRustDesk();
    }
  };

  const handleReleaseSession = () => {
    if (!socket || !device) return;
    socket.emit('operator_session_end', {
      device_id: device.device_id,
    });
    if (sessionIdRef.current) {
      handleStopSocketPreview(true);
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

  const handleSaveFleetProfile = () => {
    if (!socket) return;
    if (!server.trim() || !key.trim() || password.length < 8) {
      setFleetStatus('error');
      setFleetMessage('Please ensure valid Server, Key, and Password (>=8 chars) before saving fleet profile.');
      return;
    }

    setFleetStatus('loading');
    setFleetMessage('Saving default fleet profile in backend...');
    socket.emit(
      'update_fleet_profile',
      {
        server: server.trim(),
        relay: relay.trim(),
        key: key.trim(),
        password,
        enabled: true,
      },
      (res: any) => {
        if (res?.status === 'success') {
          setFleetStatus('success');
          setFleetMessage('Fleet default profile saved! Newly connecting tablets will auto-configure without manual input.');
          setTimeout(() => {
            setFleetStatus('idle');
            setFleetMessage('');
          }, 5000);
        } else {
          setFleetStatus('error');
          setFleetMessage(res?.message || 'Failed to save fleet profile');
        }
      }
    );
  };

  const handleLoadFleetProfile = () => {
    if (!socket) return;
    socket.emit('get_fleet_profile', (res: any) => {
      const prof = res?.profile;
      if (prof) {
        if (prof.SERVER) setServer(prof.SERVER);
        if (prof.RELAY) setRelay(prof.RELAY);
        if (prof.KEY) setKey(prof.KEY);
        if (prof.PASSWORD) setPassword(prof.PASSWORD);
        setFleetStatus('success');
        setFleetMessage('Loaded fleet profile default parameters.');
        setTimeout(() => {
          setFleetStatus('idle');
          setFleetMessage('');
        }, 3000);
      }
    });
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
      {/* Session In-Use Active Warning Banner */}
      {sessionInUse && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-error/15 border border-error/40 text-error flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-error/20 border border-error/30 shrink-0">
              <Users className="w-5 h-5 text-error" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-bold flex items-center gap-2">
                <span>Remote Session Currently Active</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-error/25 uppercase font-semibold">
                  In-Use
                </span>
              </h4>
              <p className="text-[11px] sm:text-xs opacity-90 truncate mt-0.5">
                Active Operator: <strong className="font-semibold">{sessionOperator}</strong> •{' '}
                {device.session_type === 'rustdesk' ? 'Native RustDesk Client' : 'Browser Monitor Session'}
              </p>
            </div>
          </div>
          <button
            onClick={handleReleaseSession}
            className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg bg-error/20 hover:bg-error/30 border border-error/50 text-xs font-semibold text-error transition-all shrink-0 text-center"
            title="Clear the active session broadcast if this session has concluded"
          >
            Release Session Broadcast
          </button>
        </div>
      )}

      {/* Auto-Provisioned Fleet Badge */}
      {device.is_auto_provisioned && (
        <div className="p-2.5 sm:p-3 rounded-xl bg-primary/10 border border-primary/20 text-foreground flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <span>This tablet was automatically configured via <strong>Fleet Auto-Provisioning</strong>.</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/20 text-primary font-medium shrink-0">
            Auto-Configured
          </span>
        </div>
      )}

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

        {/* Remote ID & 1-Click Connect with Auto-Fill */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <div className="p-3 sm:p-4 rounded-xl bg-background border border-border space-y-2">
            <span className="text-[11px] sm:text-xs font-semibold text-foreground/70 uppercase tracking-wider">
              RustDesk Device ID
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className={`font-mono text-xl sm:text-2xl font-bold tracking-wide truncate ${rustdeskId ? 'text-primary' : 'text-foreground/40 text-sm sm:text-base'}`}>
                {rustdeskId || (isHostRunning ? 'Connecting Host...' : 'Host Stopped')}
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
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] sm:text-xs font-semibold text-foreground/70 uppercase tracking-wider">
                  One-Click Connection
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-medium">
                  Auto-Copies Password
                </span>
              </div>
              <p className="text-xs text-foreground/60 mt-0.5 sm:mt-1">
                Launches your local RustDesk application and copies the permanent password to your clipboard.
              </p>
            </div>

            <div className="space-y-1.5">
              <button
                onClick={handleConnectRustDesk}
                className="w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-xs sm:text-sm hover:opacity-90 flex items-center justify-center gap-2 transition-all shadow-md"
              >
                {passwordCopied ? <CheckCircle2 className="w-4 h-4 text-success" /> : <ExternalLink className="w-4 h-4" />}
                <span>{passwordCopied ? 'Password Copied! Opening RustDesk...' : 'Connect via RustDesk'}</span>
              </button>

              {passwordCopied && (
                <div className="text-[11px] text-success font-medium flex items-center justify-center gap-1.5 bg-success/10 py-1 px-2 rounded border border-success/20 animate-in fade-in">
                  <Check className="w-3.5 h-3.5" />
                  <span>Password copied to clipboard. Press Ctrl+V when prompted.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Provisioning Credentials Form & Fleet Profile Management */}
      <div className="card bg-input p-4 sm:p-6 space-y-3 sm:space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 sm:pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
            <h3 className="text-base sm:text-lg font-bold">Remote Provisioning Credentials</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadFleetProfile}
              className="text-[11px] text-primary hover:underline flex items-center gap-1 px-2 py-1 rounded bg-background border border-border"
              title="Fill fields with current Fleet Default Profile"
            >
              <Sparkles className="w-3 h-3" />
              <span>Load Fleet Default</span>
            </button>
            <span className="text-xs text-foreground/50 font-mono">provisioning.json</span>
          </div>
        </div>

        <p className="text-xs text-foreground/70">
          Update the rendezvous server, relay, public key, and permanent password. Pushing credentials
          writes <code className="text-primary font-mono text-[11px]">provisioning.json</code> with root permissions
          and restarts the host service automatically.
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

          {fleetMessage && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                fleetStatus === 'success'
                  ? 'bg-success/15 border border-success/30 text-success'
                  : fleetStatus === 'error'
                  ? 'bg-error/15 border border-error/30 text-error'
                  : 'bg-primary/10 border border-primary/20 text-foreground'
              }`}
            >
              {fleetStatus === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              {fleetStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-success" />}
              {fleetStatus === 'error' && <AlertCircle className="w-4 h-4 text-error" />}
              <span>{fleetMessage}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleSaveFleetProfile}
              disabled={fleetStatus === 'loading'}
              className="py-2.5 px-4 rounded-lg bg-background border border-primary/40 hover:bg-primary/10 text-primary font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-all"
              title="Store these credentials in backend as the fleet default for all new tablets"
            >
              {fleetStatus === 'loading' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-primary" />
              )}
              <span>Save as Fleet Default Profile</span>
            </button>

            <button
              type="submit"
              disabled={provStatus === 'loading'}
              className="py-2.5 px-6 rounded-lg bg-primary text-primary-foreground font-semibold text-xs sm:text-sm hover:opacity-90 flex items-center justify-center gap-2 transition-all shadow-md"
            >
              {provStatus === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Push Provisioning & Restart Host</span>
            </button>
          </div>
        </form>
      </div>

      {/* Browser Snapshot Preview with Bandwidth & Framerate Presets */}
      <div className="card bg-input p-4 sm:p-6 space-y-3 sm:space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2.5 sm:pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Tv className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold">In-Browser Screen Preview</h3>
                <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded bg-background border border-border text-foreground/60 shrink-0">
                  Socket Stream
                </span>
              </div>
              <p className="text-[11px] text-foreground/50">
                Active Preset: <span className="text-primary font-medium">{PRESET_CONFIGS[bandwidthPreset].badge}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            {/* Bandwidth & Framerate Preset Toggle */}
            <div className="flex items-center bg-background p-1 rounded-lg border border-border text-xs">
              <button
                type="button"
                onClick={() => handlePresetToggle('lan')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  bandwidthPreset === 'lan'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground/70 hover:text-foreground'
                }`}
                title="1080p / 30fps for low-latency LAN connections"
              >
                <Wifi className="w-3.5 h-3.5" />
                <span>LAN Mode (1080p / 30fps)</span>
              </button>
              <button
                type="button"
                onClick={() => handlePresetToggle('cellular')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  bandwidthPreset === 'cellular'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground/70 hover:text-foreground'
                }`}
                title="720p / 15fps optimized for cellular weak signal kiosks"
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>Cellular (720p / 15fps)</span>
              </button>
            </div>

            {/* Stream Start/Stop */}
            {sessionState === 'connected' ? (
              <button
                onClick={() => handleStopSocketPreview(true)}
                className="py-1.5 px-3 rounded-lg bg-error text-primary-foreground text-xs font-medium hover:opacity-90 flex items-center justify-center gap-1.5 transition-all"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Stop Preview</span>
              </button>
            ) : (
              <button
                onClick={() => handleStartSocketPreview()}
                disabled={sessionState === 'connecting'}
                className="py-1.5 px-3 rounded-lg border border-border hover:bg-white/10 text-xs font-medium flex items-center justify-center gap-1.5 transition-all"
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
                For full low-latency 60fps remote control, launch the RustDesk desktop client above.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Concurrent Session Takeover Warning Dialog */}
      <ConfirmDialog
        open={warnSessionOpen}
        title="Active Remote Session Warning"
        description={`This kiosk is currently being controlled by ${sessionOperator}. Connecting may interfere with their active session. Do you want to proceed and open RustDesk?`}
        confirmLabel="Proceed & Connect"
        cancelLabel="Cancel"
        onConfirm={() => {
          setWarnSessionOpen(false);
          executeConnectRustDesk();
        }}
        onCancel={() => setWarnSessionOpen(false)}
      />
    </div>
  );
}

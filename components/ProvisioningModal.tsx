'use client';

import { useState } from 'react';
import { Socket } from 'socket.io-client';
import { Device } from '@/lib/types';
import {
  Shield,
  Server,
  Key,
  Lock,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';

interface ProvisioningModalProps {
  device: Device;
  socket: Socket | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

export const ProvisioningModal = ({
  device,
  socket,
  isOpen,
  onClose,
  onSuccess,
}: ProvisioningModalProps) => {
  const [server, setServer] = useState(device?.zhentinel_server || 'lbrdc-software.com:21116');
  const [relay, setRelay] = useState(device?.zhentinel_relay || 'lbrdc-software.com:21117');
  const [key, setKey] = useState(device?.zhentinel_key || 'uHinkRyReE2WYB5SjKrDr3n6D2KOs1ZBvb+1pcAUYNI=');
  const [password, setPassword] = useState(device?.zhentinel_password || 'Lbrdc2021.');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [fleetStatus, setFleetStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [fleetMessage, setFleetMessage] = useState('');

  // Synchronize from device data or localStorage cache
  useState(() => {
    if (typeof window !== 'undefined' && device?.device_id) {
      try {
        const cached = localStorage.getItem(`zhentinel_prov_${device.device_id}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.server && !device.zhentinel_server) setServer(parsed.server);
          if (parsed.relay && !device.zhentinel_relay) setRelay(parsed.relay);
          if (parsed.key && !device.zhentinel_key) setKey(parsed.key);
          if (parsed.password && !device.zhentinel_password) setPassword(parsed.password);
        }
      } catch (ignored) {}
    }
  });

  if (device) {
    if (device.zhentinel_server && server !== device.zhentinel_server) setServer(device.zhentinel_server);
    if (device.zhentinel_relay && relay !== device.zhentinel_relay) setRelay(device.zhentinel_relay);
    if (device.zhentinel_key && key !== device.zhentinel_key) setKey(device.zhentinel_key);
    if (device.zhentinel_password && password !== device.zhentinel_password) setPassword(device.zhentinel_password);
  }

  if (!isOpen) return null;

  const handleCopyPassword = () => {
    if (password) {
      navigator.clipboard.writeText(password);
      setCopiedPwd(true);
      setTimeout(() => setCopiedPwd(false), 2000);
    }
  };

  const handleSaveFleetProfile = () => {
    if (!socket) return;
    if (!server.trim() || !key.trim() || password.length < 8) {
      setFleetStatus('error');
      setFleetMessage('Valid Server, Key, and Password (>=8 chars) required.');
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
          setFleetMessage('Fleet Default Profile saved! New kiosks will auto-configure upon connection.');
          setTimeout(() => {
            setFleetStatus('idle');
            setFleetMessage('');
          }, 4000);
        } else {
          setFleetStatus('error');
          setFleetMessage(res?.message || 'Failed to update fleet profile');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !device) return;

    if (!server.trim()) {
      setStatus('error');
      setMessage('Server address is required');
      return;
    }
    if (!key.trim()) {
      setStatus('error');
      setMessage('Server public key is required');
      return;
    }
    if (password.length < 8) {
      setStatus('error');
      setMessage('Permanent password must be at least 8 characters');
      return;
    }

    setStatus('loading');
    setMessage('Applying provisioning and restarting Zhentinel...');

    const payload = {
      server: server.trim(),
      relay: relay.trim(),
      key: key.trim(),
      password,
    };

    try {
      const response: any = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Provisioning command timed out after 25 seconds'));
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
        setStatus('success');
        const successMsg = result?.message || 'Zhentinel credentials updated and host restarted successfully!';
        setMessage(successMsg);
        if (onSuccess) {
          onSuccess(successMsg);
        }
        setTimeout(() => {
          onClose();
          setStatus('idle');
          setMessage('');
        }, 1800);
      } else {
        setStatus('error');
        setMessage(result?.message || response?.message || 'Failed to update remote credentials');
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Error executing provisioning update');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-input shadow-2xl p-4 sm:p-6 text-foreground max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
            <h3 className="text-base sm:text-lg font-bold">Zhentinel Remote Provisioning</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 sm:p-1.5 rounded-lg text-foreground/60 hover:text-foreground hover:bg-white/10 transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Device Info & Fleet Profile Helper */}
        <div className="my-3 sm:my-4 p-2.5 sm:p-3 rounded-lg bg-background border border-border/60 text-xs flex flex-col gap-2">
          <div className="flex justify-between items-center gap-2">
            <div className="truncate">
              <span className="font-semibold text-foreground/80">Target:</span>{' '}
              <span className="font-medium text-foreground">{device.device_name}</span>
            </div>
            <div className="shrink-0">
              <span className="font-semibold text-foreground/80">ID:</span>{' '}
              <span className="font-mono text-primary font-bold">{device.rustdesk_id || device.zhentinel_id || 'Pending'}</span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-border/40 text-[11px]">
            <span className="text-foreground/60">Fleet Auto-Provisioning Profile:</span>
            <button
              type="button"
              onClick={handleLoadFleetProfile}
              className="text-primary hover:underline flex items-center gap-1 font-medium"
            >
              <Sparkles className="w-3 h-3" />
              <span>Load Fleet Default</span>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
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
              <Server className="w-3.5 h-3.5 text-primary/70" /> Relay Server (Optional)
            </label>
            <input
              type="text"
              value={relay}
              onChange={(e) => setRelay(e.target.value)}
              placeholder="e.g. lbrdc-software.com:21117"
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary font-mono"
            />
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="text-[11px] text-foreground/70 hover:text-foreground flex items-center gap-1"
                  title="Copy permanent password"
                >
                  {copiedPwd ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedPwd ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-primary hover:underline"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              required
            />
            <p className="text-[11px] text-foreground/50 mt-1">
              Sets the permanent remote-access password on the target tablet.
            </p>
          </div>

          {/* Fleet Profile Message */}
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

          {/* Feedback message */}
          {message && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                status === 'success'
                  ? 'bg-success/15 border border-success/30 text-success'
                  : status === 'error'
                  ? 'bg-error/15 border border-error/30 text-error'
                  : 'bg-primary/10 border border-primary/20 text-foreground'
              }`}
            >
              {status === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              {status === 'success' && <CheckCircle2 className="w-4 h-4 text-success" />}
              {status === 'error' && <AlertCircle className="w-4 h-4 text-error" />}
              <span>{message}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-3 pt-3 border-t border-border mt-4">
            <button
              type="button"
              onClick={handleSaveFleetProfile}
              disabled={fleetStatus === 'loading'}
              className="w-full sm:w-auto px-3.5 py-2 rounded-lg text-xs font-medium border border-primary/30 hover:bg-primary/10 text-primary flex items-center justify-center gap-1.5 transition-all text-center"
              title="Save current credentials as the default auto-provision profile for all future tablets"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Save as Fleet Default</span>
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={status === 'loading'}
                className="flex-1 sm:flex-initial px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium border border-border hover:bg-white/5 transition-colors text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === 'loading'}
                className="flex-1 sm:flex-initial px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center gap-2 transition-all shadow-md"
              >
                {status === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Push & Restart</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

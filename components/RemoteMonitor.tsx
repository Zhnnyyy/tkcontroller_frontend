'use client';

import { PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { Device } from '@/lib/types';

type SessionState = 'idle' | 'connecting' | 'connected' | 'error' | 'ended';
type ControlState = 'disconnected' | 'connecting' | 'connected';

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
  const sessionIdRef = useRef<string | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; at: number } | null>(null);

  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [controlState, setControlState] = useState<ControlState>('disconnected');
  const [statusMessage, setStatusMessage] = useState('No active stream');
  const [screenInfo, setScreenInfo] = useState<ScreenInfo | null>(null);
  const [frameSrc, setFrameSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleFrame = (data: any) => {
      if (data?.session_id !== sessionIdRef.current) {
        return;
      }

      const frame = data?.frame;
      if (!frame?.image) {
        return;
      }

      const mimeType = frame?.mime_type || 'image/png';
      setFrameSrc(`data:${mimeType};base64,${frame.image}`);
      setSessionState('connected');
      setControlState('connected');
      setStatusMessage('Live stream active');

      const width = Number(frame?.width) || 0;
      const height = Number(frame?.height) || 0;
      if (width > 0 && height > 0) {
        setScreenInfo({ width, height });
      }
    };

    const handleInfo = (data: any) => {
      if (data?.session_id !== sessionIdRef.current) {
        return;
      }

      const screen = data?.info?.screen;
      if (screen) {
        setScreenInfo({
          width: Number(screen.width) || 0,
          height: Number(screen.height) || 0,
        });
      }
    };

    const handleState = (data: any) => {
      if (data?.session_id !== sessionIdRef.current) {
        return;
      }

      const state = String(data?.state || '').toLowerCase();
      const message = data?.message || 'Stream state updated';
      setStatusMessage(message);

      if (state === 'connected' || state === 'connecting') {
        setSessionState(state as SessionState);
        return;
      }

      setSessionState(state === 'error' ? 'error' : 'ended');
      setControlState('disconnected');
      if (state !== 'connected') {
        setFrameSrc(null);
      }
    };

    const handleStop = (data: any) => {
      if (data?.session_id !== sessionIdRef.current) {
        return;
      }

      setSessionState('ended');
      setControlState('disconnected');
      setStatusMessage(data?.reason || 'Stream ended');
      setFrameSrc(null);
      sessionIdRef.current = null;
    };

    socket.on('monitor_frame', handleFrame);
    socket.on('monitor_info', handleInfo);
    socket.on('monitor_state', handleState);
    socket.on('monitor_stop', handleStop);

    return () => {
      socket.off('monitor_frame', handleFrame);
      socket.off('monitor_info', handleInfo);
      socket.off('monitor_state', handleState);
      socket.off('monitor_stop', handleStop);
    };
  }, [socket]);

  useEffect(() => {
    stopSession(true, 'viewer_switch_device');
    if (!device) {
      setSessionState('idle');
      setControlState('disconnected');
      setScreenInfo(null);
      setFrameSrc(null);
      setStatusMessage('Select a device to start monitoring');
      return;
    }
    setSessionState('idle');
    setControlState('disconnected');
    setScreenInfo(null);
    setFrameSrc(null);
    setStatusMessage('Ready to start monitoring');
  }, [device?.device_id]);

  const stopSession = (notifyServer: boolean, reason = 'viewer_stop') => {
    const activeSessionId = sessionIdRef.current;
    if (notifyServer && socket && activeSessionId && device?.device_id) {
      socket.emit('monitor_stop', {
        session_id: activeSessionId,
        device_id: device.device_id,
        reason,
      });
    }

    sessionIdRef.current = null;
    setControlState('disconnected');
    setScreenInfo(null);
    setFrameSrc(null);
  };

  const startSession = () => {
    if (!socket || !device?.device_id) {
      return;
    }

    stopSession(false);

    const sessionId = createSessionId();
    sessionIdRef.current = sessionId;
    setSessionState('connecting');
    setControlState('connecting');
    setStatusMessage('Requesting device stream');

    socket.emit(
      'monitor_start',
      {
        session_id: sessionId,
        device_id: device.device_id,
      },
      (response: any) => {
        if (response?.status !== 'success') {
          setSessionState('error');
          setControlState('disconnected');
          setStatusMessage(response?.message || 'Failed to start stream');
          sessionIdRef.current = null;
          return;
        }
        setStatusMessage('Waiting for device frames');
      }
    );
  };

  const canStart = Boolean(
    socket &&
      device?.device_id &&
      device.connection_status === 'connected' &&
      sessionState !== 'connecting'
  );

  const sendControlMessage = (payload: Record<string, unknown>) => {
    if (!socket || !sessionIdRef.current || !device?.device_id) {
      return false;
    }

    socket.emit('monitor_control', {
      session_id: sessionIdRef.current,
      device_id: device.device_id,
      payload,
    });
    return true;
  };

  const getNormalizedPoint = (clientX: number, clientY: number) => {
    const image = imageRef.current;
    if (!image) {
      return null;
    }

    const rect = image.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return null;
    }

    const imageWidth = image.naturalWidth || screenInfo?.width || 0;
    const imageHeight = image.naturalHeight || screenInfo?.height || 0;
    if (!imageWidth || !imageHeight) {
      return null;
    }

    const elementAspect = rect.width / rect.height;
    const imageAspect = imageWidth / imageHeight;

    let renderWidth = rect.width;
    let renderHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (imageAspect > elementAspect) {
      renderHeight = rect.width / imageAspect;
      offsetY = (rect.height - renderHeight) / 2;
    } else {
      renderWidth = rect.height * imageAspect;
      offsetX = (rect.width - renderWidth) / 2;
    }

    const localX = clientX - rect.left - offsetX;
    const localY = clientY - rect.top - offsetY;
    if (localX < 0 || localY < 0 || localX > renderWidth || localY > renderHeight) {
      return null;
    }

    return {
      x: localX / renderWidth,
      y: localY / renderHeight,
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const point = getNormalizedPoint(event.clientX, event.clientY);
    if (!point) {
      return;
    }
    pointerStartRef.current = {
      x: point.x,
      y: point.y,
      at: Date.now(),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) {
      return;
    }

    const end = getNormalizedPoint(event.clientX, event.clientY);
    if (!end) {
      return;
    }

    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const durationMs = Math.max(80, Date.now() - start.at);

    if (distance < 0.015) {
      sendControlMessage({
        type: 'tap',
        x: end.x,
        y: end.y,
      });
      return;
    }

    sendControlMessage({
      type: 'swipe',
      startX: start.x,
      startY: start.y,
      endX: end.x,
      endY: end.y,
      durationMs,
    });
  };

  const handlePointerCancel = () => {
    pointerStartRef.current = null;
  };

  const sendKey = (key: 'BACK' | 'HOME' | 'APP_SWITCH' | 'POWER') => {
    sendControlMessage({
      type: 'key',
      key,
    });
  };

  return (
    <div className="card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Live Monitor</h2>
          <p className="mt-1 text-sm text-foreground/60">
            Socket-relayed screen stream and remote control for the selected device
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={startSession}
            disabled={!canStart}
          >
            {sessionState === 'connecting' ? 'Connecting...' : 'Start Stream'}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setSessionState('ended');
              setStatusMessage('Stream stopped by viewer');
              stopSession(true);
            }}
            disabled={!sessionIdRef.current}
          >
            Stop
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border bg-background/80 p-3">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-foreground/70">
            {device ? `${device.device_name} (${device.device_id})` : 'No device selected'}
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              sessionState === 'connected'
                ? 'bg-success/15 text-green-300'
                : sessionState === 'error'
                  ? 'bg-error/15 text-red-300'
                  : sessionState === 'connecting'
                    ? 'bg-warning/15 text-yellow-200'
                    : 'bg-input text-foreground/70'
            }`}
          >
            {sessionState}
          </span>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-ghost"
            disabled={controlState !== 'connected'}
            onClick={() => sendKey('BACK')}
          >
            Back
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={controlState !== 'connected'}
            onClick={() => sendKey('HOME')}
          >
            Home
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={controlState !== 'connected'}
            onClick={() => sendKey('APP_SWITCH')}
          >
            Recents
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={controlState !== 'connected'}
            onClick={() => sendKey('POWER')}
          >
            Power
          </button>
        </div>

        <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-black">
          {frameSrc ? (
            <img
              ref={imageRef}
              src={frameSrc}
              alt="Remote device screen"
              className="h-full w-full object-contain"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
              No frame received yet
            </div>
          )}
          <div
            className={`absolute inset-0 ${
              controlState === 'connected' ? 'cursor-crosshair' : 'cursor-not-allowed'
            }`}
            onPointerDown={controlState === 'connected' ? handlePointerDown : undefined}
            onPointerUp={controlState === 'connected' ? handlePointerUp : undefined}
            onPointerCancel={handlePointerCancel}
          />
        </div>

        <p className="mt-3 text-sm text-foreground/60">{statusMessage}</p>
        <p className="mt-1 text-xs text-foreground/50">
          Control: {controlState}
          {screenInfo ? ` | ${screenInfo.width}x${screenInfo.height}` : ''}
        </p>
        <p className="mt-1 text-xs text-foreground/50">
          Tap to click. Drag on the stream to send a swipe.
        </p>
      </div>
    </div>
  );
}
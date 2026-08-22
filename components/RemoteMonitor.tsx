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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const monitorContainerRef = useRef<HTMLDivElement | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; at: number } | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [controlState, setControlState] = useState<ControlState>('disconnected');
  const [statusMessage, setStatusMessage] = useState('No active stream');
  const [screenInfo, setScreenInfo] = useState<ScreenInfo | null>(null);
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const [webrtcStream, setWebrtcStream] = useState<MediaStream | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
      setWebrtcStream(null);
      sessionIdRef.current = null;
    };

    const handleWebRtcAnswer = async (data: any) => {
      if (data?.session_id !== sessionIdRef.current || !peerConnectionRef.current) {
        return;
      }
      try {
        const desc = new RTCSessionDescription(data.description);
        await peerConnectionRef.current.setRemoteDescription(desc);
      } catch (err) {
        console.error('Failed to set remote SDP answer', err);
      }
    };

    const handleWebRtcIceCandidate = async (data: any) => {
      if (
        data?.session_id !== sessionIdRef.current ||
        !peerConnectionRef.current ||
        !data.candidate
      ) {
        return;
      }
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (err) {
        console.warn('Failed to add remote ICE candidate', err);
      }
    };

    const handleWebRtcSessionState = (data: any) => {
      if (data?.session_id !== sessionIdRef.current) {
        return;
      }
      const state = String(data?.state || '').toLowerCase();
      setStatusMessage(data.message || `WebRTC Session State: ${state}`);
      if (state === 'error' || state === 'closed' || state === 'ended' || state === 'failed') {
        setSessionState(state === 'error' ? 'error' : 'ended');
        setControlState('disconnected');
        setWebrtcStream(null);
      }
    };

    socket.on('monitor_frame', handleFrame);
    socket.on('monitor_info', handleInfo);
    socket.on('monitor_state', handleState);
    socket.on('monitor_stop', handleStop);
    socket.on('webrtc_answer', handleWebRtcAnswer);
    socket.on('webrtc_ice_candidate', handleWebRtcIceCandidate);
    socket.on('webrtc_session_state', handleWebRtcSessionState);

    return () => {
      socket.off('monitor_frame', handleFrame);
      socket.off('monitor_info', handleInfo);
      socket.off('monitor_state', handleState);
      socket.off('monitor_stop', handleStop);
      socket.off('webrtc_answer', handleWebRtcAnswer);
      socket.off('webrtc_ice_candidate', handleWebRtcIceCandidate);
      socket.off('webrtc_session_state', handleWebRtcSessionState);
    };
  }, [socket]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === monitorContainerRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && webrtcStream) {
      videoRef.current.srcObject = webrtcStream;
    }
  }, [webrtcStream]);

  useEffect(() => {
    stopSession(true, 'viewer_switch_device');
    if (!device) {
      setSessionState('idle');
      setControlState('disconnected');
      setScreenInfo(null);
      setFrameSrc(null);
      setWebrtcStream(null);
      setStatusMessage('Select a device to start monitoring');
      return;
    }
    setSessionState('idle');
    setControlState('disconnected');
    setScreenInfo(null);
    setFrameSrc(null);
    setWebrtcStream(null);
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
      socket.emit('webrtc_hangup', {
        session_id: activeSessionId,
        device_id: device.device_id,
        reason,
      });
    }

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setWebrtcStream(null);
    sessionIdRef.current = null;
    setControlState('disconnected');
    setScreenInfo(null);
    setFrameSrc(null);
  };

  const startSession = async () => {
    if (!socket || !device?.device_id) {
      return;
    }

    stopSession(false);

    const sessionId = createSessionId();
    sessionIdRef.current = sessionId;
    setSessionState('connecting');
    setControlState('connecting');
    setStatusMessage('Fetching connection settings...');

    try {
      let iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ];

      try {
        const response = await new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout fetching ICE servers')), 3000);
          socket.emit('get_ice_servers', (res: any) => {
            clearTimeout(timeout);
            resolve(res);
          });
        });
        if (response && response.status === 'success' && Array.isArray(response.iceServers)) {
          iceServers = response.iceServers;
        }
      } catch (err) {
        console.warn('Failed to fetch ICE servers from backend, falling back to public STUN:', err);
      }

      setStatusMessage('Initializing WebRTC connection...');
      const pc = new RTCPeerConnection({ iceServers });
      peerConnectionRef.current = pc;

      pc.addTransceiver('video', { direction: 'recvonly' });

      const dc = pc.createDataChannel('control', { ordered: true });
      dataChannelRef.current = dc;

      dc.onopen = () => {
        setControlState('connected');
        console.log('[WebRTC] Control data channel opened');
      };
      dc.onclose = () => {
        setControlState('disconnected');
        console.log('[WebRTC] Control data channel closed');
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && socket && sessionIdRef.current && device?.device_id) {
          socket.emit('webrtc_ice_candidate', {
            session_id: sessionIdRef.current,
            device_id: device.device_id,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setWebrtcStream(event.streams[0]);
          setSessionState('connected');
          setStatusMessage('Live WebRTC stream active');
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit(
        'webrtc_offer',
        {
          session_id: sessionId,
          device_id: device.device_id,
          description: {
            type: offer.type,
            sdp: offer.sdp,
          },
        },
        (response: any) => {
          if (response?.status !== 'success') {
            setSessionState('error');
            setControlState('disconnected');
            setStatusMessage(response?.message || 'Failed to send WebRTC offer');
            stopSession(false);
          } else {
            setStatusMessage('WebRTC offer sent, waiting for remote answer...');
          }
        }
      );
    } catch (e) {
      setSessionState('error');
      setControlState('disconnected');
      setStatusMessage('WebRTC initialization failed: ' + (e instanceof Error ? e.message : String(e)));
      stopSession(false);
    }
  };

  const canStart = Boolean(
    socket &&
      device?.device_id &&
      device.connection_status === 'connected' &&
      sessionState !== 'connecting'
  );

  const sendControlMessage = (payload: Record<string, unknown>) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      try {
        dataChannelRef.current.send(JSON.stringify(payload));
        return true;
      } catch (err) {
        console.warn('Failed to send control message via WebRTC DataChannel, falling back to socket', err);
      }
    }

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
    const element = videoRef.current || imageRef.current;
    if (!element) {
      return null;
    }

    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return null;
    }

    const nativeWidth = (element as HTMLVideoElement).videoWidth || (element as HTMLImageElement).naturalWidth || screenInfo?.width || 0;
    const nativeHeight = (element as HTMLVideoElement).videoHeight || (element as HTMLImageElement).naturalHeight || screenInfo?.height || 0;
    if (!nativeWidth || !nativeHeight) {
      return null;
    }

    const elementAspect = rect.width / rect.height;
    const imageAspect = nativeWidth / nativeHeight;

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

  const toggleFullscreen = async () => {
    const monitorContainer = monitorContainerRef.current;
    if (!monitorContainer) {
      return;
    }

    if (document.fullscreenElement === monitorContainer) {
      await document.exitFullscreen();
      return;
    }

    await monitorContainer.requestFullscreen();
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
              void toggleFullscreen();
            }}
          >
            {isFullscreen ? 'Exit Big Screen' : 'Big Screen'}
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

        <div
          ref={monitorContainerRef}
          className={`relative aspect-video overflow-hidden rounded-lg border border-border bg-black ${
            isFullscreen ? 'flex h-screen w-screen items-center justify-center rounded-none border-0' : ''
          }`}
        >
          {webrtcStream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-contain"
            />
          ) : frameSrc ? (
            <img
              ref={imageRef}
              src={frameSrc}
              alt="Remote device screen"
              className="h-full w-full object-contain"
              draggable={false}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
              No stream or frame received yet
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

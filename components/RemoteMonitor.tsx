'use client';

import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { Device } from '@/lib/types';

type SessionState = 'idle' | 'connecting' | 'connected' | 'error' | 'ended';

const ICE_SERVERS = (() => {
  const raw = process.env.NEXT_PUBLIC_WEBRTC_ICE_SERVERS;
  if (!raw) {
    return [{ urls: ['stun:stun.l.google.com:19302'] }];
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    if (parsed && typeof parsed === 'object') {
      return [parsed];
    }
  } catch {
    const urls = raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (urls.length > 0) {
      return [{ urls }];
    }
  }

  return [{ urls: ['stun:stun.l.google.com:19302'] }];
})();

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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [statusMessage, setStatusMessage] = useState('No active stream');

  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleAnswer = async (data: any) => {
      if (data?.session_id !== sessionIdRef.current || !peerConnectionRef.current) {
        return;
      }

      try {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(data.description)
        );
        setSessionState('connecting');
        setStatusMessage('Awaiting media track');
      } catch (error) {
        console.error('[WebRTC] Failed to apply remote description', error);
        setSessionState('error');
        setStatusMessage('Failed to apply remote answer');
      }
    };

    const handleIceCandidate = async (data: any) => {
      if (data?.session_id !== sessionIdRef.current || !peerConnectionRef.current) {
        return;
      }

      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (error) {
        console.error('[WebRTC] Failed to add remote ICE candidate', error);
      }
    };

    const handleSessionState = (data: any) => {
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
      stopSession(false);
    };

    const handleHangup = (data: any) => {
      if (data?.session_id !== sessionIdRef.current) {
        return;
      }
      setSessionState('ended');
      setStatusMessage(data?.reason || 'Stream ended');
      stopSession(false);
    };

    socket.on('webrtc_answer', handleAnswer);
    socket.on('webrtc_ice_candidate', handleIceCandidate);
    socket.on('webrtc_session_state', handleSessionState);
    socket.on('webrtc_hangup', handleHangup);

    return () => {
      socket.off('webrtc_answer', handleAnswer);
      socket.off('webrtc_ice_candidate', handleIceCandidate);
      socket.off('webrtc_session_state', handleSessionState);
      socket.off('webrtc_hangup', handleHangup);
    };
  }, [socket]);

  useEffect(() => {
    stopSession(true);
    if (!device) {
      setSessionState('idle');
      setStatusMessage('Select a device to start monitoring');
      return;
    }
    setSessionState('idle');
    setStatusMessage('Ready to start monitoring');
  }, [device?.device_id]);

  const stopSession = (notifyServer: boolean) => {
    const activeSessionId = sessionIdRef.current;
    if (notifyServer && socket && activeSessionId && device?.device_id) {
      socket.emit('webrtc_hangup', {
        session_id: activeSessionId,
        device_id: device.device_id,
        reason: 'viewer_stop',
      });
    }

    sessionIdRef.current = null;

    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const startSession = async () => {
    if (!socket || !device?.device_id) {
      return;
    }

    stopSession(false);

    const sessionId = createSessionId();
    const peerConnection = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });

    sessionIdRef.current = sessionId;
    peerConnectionRef.current = peerConnection;
    remoteStreamRef.current = new MediaStream();

    if (videoRef.current) {
      videoRef.current.srcObject = remoteStreamRef.current;
    }

    peerConnection.addTransceiver('video', { direction: 'recvonly' });

    peerConnection.ontrack = (event) => {
      const stream = remoteStreamRef.current;
      event.streams[0]?.getTracks().forEach((track) => {
        if (!stream?.getTracks().find((existing) => existing.id === track.id)) {
          stream?.addTrack(track);
        }
      });
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
      }
      setSessionState('connected');
      setStatusMessage('Live stream active');
    };

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate || !sessionIdRef.current) {
        return;
      }
      socket.emit('webrtc_ice_candidate', {
        session_id: sessionIdRef.current,
        device_id: device.device_id,
        candidate: event.candidate.toJSON(),
      });
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      if (state === 'failed') {
        setSessionState('error');
        setStatusMessage('Peer connection failed');
      } else if (state === 'disconnected' || state === 'closed') {
        setSessionState('ended');
        setStatusMessage('Peer connection closed');
      }
    };

    setSessionState('connecting');
    setStatusMessage('Creating WebRTC offer');

    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      socket.emit(
        'webrtc_offer',
        {
          session_id: sessionId,
          device_id: device.device_id,
          description: peerConnection.localDescription,
        },
        (response: any) => {
          if (response?.status !== 'success') {
            setSessionState('error');
            setStatusMessage(response?.message || 'Failed to send offer');
            stopSession(false);
            return;
          }
          setStatusMessage('Offer sent to device');
        }
      );
    } catch (error) {
      console.error('[WebRTC] Failed to start session', error);
      setSessionState('error');
      setStatusMessage('Failed to start WebRTC session');
      stopSession(false);
    }
  };

  const canStart = Boolean(
    socket &&
      device?.device_id &&
      device.connection_status === 'connected' &&
      sessionState !== 'connecting'
  );

  return (
    <div className="card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Live Monitor</h2>
          <p className="mt-1 text-sm text-foreground/60">
            WebRTC screen stream from the selected controller device
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

        <div className="aspect-video overflow-hidden rounded-lg border border-border bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-contain"
          />
        </div>

        <p className="mt-3 text-sm text-foreground/60">{statusMessage}</p>
      </div>
    </div>
  );
}

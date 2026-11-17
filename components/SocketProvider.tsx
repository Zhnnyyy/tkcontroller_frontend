'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Socket } from 'socket.io-client';
import { initializeSocket, closeSocket } from '@/lib/socket';
import { Device } from '@/lib/types';

const normalizeDevice = (data: any, existing?: Device): Device => {
  const deviceId = data?.device_id ?? data?.deviceId ?? existing?.device_id ?? '';
  const deviceName = data?.device_name ?? data?.deviceName ?? existing?.device_name ?? 'Unknown';
  const statusRaw =
    data?.connection_status ??
    data?.connectionStatus ??
    data?.status ??
    existing?.connection_status;

  let connectionStatus: Device['connection_status'];
  if (statusRaw === 'connected' || statusRaw === 'connecting' || statusRaw === 'disconnected') {
    connectionStatus = statusRaw;
  } else if (statusRaw === 'online') {
    connectionStatus = 'connected';
  } else if (statusRaw === 'offline') {
    connectionStatus = 'disconnected';
  } else {
    connectionStatus = existing?.connection_status ?? 'connected';
  }

  return {
    device_id: deviceId,
    device_name: deviceName,
    connection_status: connectionStatus,
    health_metrics: data?.health_metrics ?? data?.healthMetrics ?? existing?.health_metrics,
    last_seen: data?.last_seen ?? data?.lastSeen ?? existing?.last_seen,
    rustdesk_id: data?.rustdesk_id ?? data?.zhentinel_id ?? existing?.rustdesk_id ?? existing?.zhentinel_id,
    zhentinel_id: data?.zhentinel_id ?? data?.rustdesk_id ?? existing?.zhentinel_id ?? existing?.rustdesk_id,
    zhentinel_status: data?.zhentinel_status ?? existing?.zhentinel_status,
    zhentinel_server: data?.zhentinel_server ?? existing?.zhentinel_server,
    zhentinel_relay: data?.zhentinel_relay ?? existing?.zhentinel_relay,
    zhentinel_key: data?.zhentinel_key ?? existing?.zhentinel_key,
    zhentinel_password: data?.zhentinel_password ?? existing?.zhentinel_password,
    session_in_use: data?.session_in_use !== undefined ? Boolean(data?.session_in_use) : existing?.session_in_use,
    session_operator: data?.session_operator ?? existing?.session_operator,
    session_type: data?.session_type ?? existing?.session_type,
    session_started_at: data?.session_started_at ?? existing?.session_started_at,
    is_auto_provisioned: data?.is_auto_provisioned ?? existing?.is_auto_provisioned,
  };
};

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  devices: Device[];
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);

  useEffect(() => {
    const backendUrl = 'https://tkcontroller-backend.onrender.com';
    const newSocket = initializeSocket(backendUrl);

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('[v0] Socket connected');
      newSocket.emit('join_room');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[v0] Socket disconnected');
    });

    newSocket.on('device_list', (data: Device[]) => {
      console.log('[v0] Received device list:', data);
      setDevices((prev) => data.map((device) => normalizeDevice(device, prev.find((d) => d.device_id === (device as any)?.device_id))));
    });

    newSocket.on('device_status', (data: Device) => {
      console.log('[v0] Device status update:', data);
      setDevices((prev) => {
        const deviceId = (data as any)?.device_id ?? (data as any)?.deviceId;
        const index = prev.findIndex((d) => d.device_id === deviceId);
        if (index === -1) {
          return [...prev, normalizeDevice(data)];
        }
        const next = [...prev];
        next[index] = normalizeDevice(data, prev[index]);
        return next;
      });
    });

    newSocket.on('device_disconnected', (data: { device_id: string }) => {
      console.log('[v0] Device disconnected:', data);
      setDevices((prev) =>
        prev.map((d) =>
          d.device_id === data.device_id
            ? { ...d, connection_status: 'disconnected', last_seen: new Date().toISOString() }
            : d
        )
      );
    });

    newSocket.on('session_status', (data: any) => {
      console.log('[v0] Session status broadcast:', data);
      const targetId = data?.device_id || data?.deviceId;
      if (!targetId) return;
      setDevices((prev) =>
        prev.map((d) =>
          d.device_id === targetId
            ? {
                ...d,
                session_in_use: Boolean(data.in_use),
                session_operator: data.in_use ? (data.operator || 'Operator') : null,
                session_type: data.in_use ? (data.type || 'remote') : null,
                session_started_at: data.in_use ? (data.started_at || Date.now()) : null,
              }
            : d
        )
      );
    });

    setSocket(newSocket);

    return () => {
      closeSocket();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, devices }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};

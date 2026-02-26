'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Socket } from 'socket.io-client';
import { initializeSocket, closeSocket } from '@/lib/socket';
import { Device } from '@/lib/types';

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
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
    const newSocket = initializeSocket(backendUrl);

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('[v0] Socket connected');
      newSocket.emit('get_devices');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[v0] Socket disconnected');
    });

    newSocket.on('device_list', (data: Device[]) => {
      console.log('[v0] Received device list:', data);
      setDevices(data);
    });

    newSocket.on('device_status', (data: Device) => {
      console.log('[v0] Device status update:', data);
      setDevices((prev) =>
        prev.map((d) => (d.device_id === data.device_id ? data : d))
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

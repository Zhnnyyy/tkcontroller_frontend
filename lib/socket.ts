import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const initializeSocket = (url: string = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000') => {
  if (socket) return socket;

  socket = io(url, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected to backend');
  });

  socket.on('disconnect', () => {
    console.log('[Socket] Disconnected from backend');
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error);
  });

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const executeCommand = (socket: Socket, deviceId: string, command: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Command execution timeout'));
    }, 30000);

    socket.emit('send_command', { device_id: deviceId, command }, (response: any) => {
      clearTimeout(timeout);
      resolve(response);
    });
  });
};

export const closeSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const initializeSocket = (url: string = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3002') => {
  if (socket) return socket;

  socket = io(url, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 0,
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

export const executeCommand = (
  socket: Socket,
  deviceId: string,
  command: string,
  payload?: Record<string, any>
): Promise<any> => {
  return new Promise((resolve, reject) => {
    const timeoutMs =
      command === 'install_lbrdc_service' || command === 'install_usb_autogrant_module'
        ? 180000
        : 30000;
    const timeout = setTimeout(() => {
      reject(new Error('Command execution timeout'));
    }, timeoutMs);

    socket.emit(
      'send_command',
      { deviceId, device_id: deviceId, command, payload },
      (response: any) => {
      clearTimeout(timeout);
      resolve(response);
      }
    );
  });
};

export const closeSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

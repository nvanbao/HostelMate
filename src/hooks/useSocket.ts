import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const configuredApiUrl = import.meta.env.VITE_API_URL || '/api';
const SOCKET_URL = configuredApiUrl.startsWith('http')
  ? configuredApiUrl.replace(/\/api\/?$/, '')
  : window.location.origin;

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const instance = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    setSocket(instance);

    return () => {
      instance.disconnect();
      setSocket(null);
    };
  }, []);

  return socket;
}

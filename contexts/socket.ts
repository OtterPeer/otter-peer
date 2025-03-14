import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (signalingServerURL: string, token: string): Socket => {
  if (!socket) {
    socket = io(signalingServerURL, {
      auth: { token },
    });
  }
  return socket;
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
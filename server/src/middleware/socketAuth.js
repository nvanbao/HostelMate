import jwt from 'jsonwebtoken';

const readTokenCookie = (cookieHeader = '') => cookieHeader
  .split(';')
  .map((part) => part.trim())
  .find((part) => part.startsWith('token='))
  ?.slice('token='.length);

export const socketAuth = (jwtSecret) => (socket, next) => {
  try {
    socket.data.user = jwt.verify(readTokenCookie(socket.handshake.headers.cookie), jwtSecret);
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
};

import jwt from 'jsonwebtoken';
import { queryOne } from '../../db.js';
import { getJwtSecret } from '../utils/jwtSecret.js';

const JWT_SECRET = getJwtSecret();

export const authenticateToken = async (req, res, next) => {
  const token = req.cookies?.token || (req.headers.authorization ? req.headers.authorization.split(' ')[1] : null);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    
    if (payload.role === 'TENANT') {
      const user = await queryOne('SELECT id, username FROM khach_thue WHERE id = ?', [payload.id]);
      if (!user || !user.username) {
        return res.status(401).json({ error: 'Tài khoản không còn tồn tại hoặc đã bị thu hồi' });
      }
    } else {
      const user = await queryOne('SELECT token_version FROM users WHERE id = ?', [payload.id]);
      if (!user || user.token_version !== payload.token_version) {
        return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn hoặc bị vô hiệu hóa' });
      }
    }
    
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const optionalAuthToken = async (req, res, next) => {
  const token = req.cookies?.token || (req.headers.authorization ? req.headers.authorization.split(' ')[1] : null);
  if (!token) {
    return next();
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    
    if (payload.role === 'TENANT') {
      const user = await queryOne('SELECT id, username FROM khach_thue WHERE id = ?', [payload.id]);
      if (user && user.username) {
        req.user = payload;
      }
    } else {
      const user = await queryOne('SELECT token_version FROM users WHERE id = ?', [payload.id]);
      if (user && user.token_version === payload.token_version) {
        req.user = payload;
      }
    }
    next();
  } catch {
    // If token is invalid, just proceed as guest
    next();
  }
};

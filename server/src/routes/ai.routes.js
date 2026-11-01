import express from 'express';
import rateLimit from 'express-rate-limit';
import { chat } from '../controllers/ai.controller.js';

import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { error: 'Bạn gửi tin nhắn quá nhanh. Vui lòng thử lại sau 1 phút.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/chat', authenticateToken, aiLimiter, chat);

export default router;

import express from 'express';
import rateLimit from 'express-rate-limit';
import { chat } from '../controllers/ai.controller.js';

import { optionalAuthToken } from '../middleware/auth.js';

const router = express.Router();

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // Limit each IP to 1000 requests per minute (Increased for testing)
  message: { error: 'Bạn gửi tin nhắn quá nhanh. Vui lòng thử lại sau 1 phút.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/chat', aiLimiter, optionalAuthToken, chat);

export default router;

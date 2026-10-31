import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import http from 'http';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { Server as SocketIOServer } from 'socket.io';
import { fileURLToPath } from 'url';
import { query, queryOne, run, dbReady } from './db.js';
import { setupContracts } from './contracts.js';
import aiRoutes from './src/routes/ai.routes.js';
import { setupIntegratedRoutes } from './integrated-routes.js';
import { getJwtSecret } from './src/utils/jwtSecret.js';
import { socketAuth } from './src/middleware/socketAuth.js';
import { registerRoomRoutes } from './src/routes/rooms.routes.js';
import { registerTenantRoutes } from './src/routes/tenants.routes.js';
import { registerAssignmentRoutes } from './src/routes/assignments.routes.js';
import { registerMeterReadingRoutes } from './src/routes/meterReadings.routes.js';
import { registerInvoiceRoutes } from './src/routes/invoices.routes.js';
import { registerRepairRoutes } from './src/routes/repairs.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, { cors: { origin: true, credentials: true } });
const port = Number(process.env.PORT || 5000);
const JWT_SECRET = getJwtSecret();

app.set('trust proxy', 1);
app.set('io', io);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 15000, standardHeaders: true, legacyHeaders: false }));
app.use('/api/ai', aiRoutes);

io.use(socketAuth(JWT_SECRET));

const { authenticate, requireAdmin } = setupIntegratedRoutes(app, {
  query,
  queryOne,
  run,
  io,
  jwtSecret: JWT_SECRET,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
});

const routeDeps = { authenticate, requireAdmin, io };
registerRoomRoutes(app, routeDeps);
registerTenantRoutes(app, routeDeps);
registerAssignmentRoutes(app, routeDeps);
registerMeterReadingRoutes(app, routeDeps);
registerInvoiceRoutes(app, routeDeps);
registerRepairRoutes(app, routeDeps);

// Tenant contract and portal routes.
setupContracts(app, query, queryOne, run, { authenticate });

// In production the API also serves the built frontend, so one process is enough to deploy.
const distDir = path.join(__dirname, '..', 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => (req.path.startsWith('/api') ? next() : res.sendFile(path.join(distDir, 'index.html'))));
}

if (process.env.NODE_ENV !== 'test') {
  dbReady
    .then(() => {
      httpServer.listen(port, () => {
        console.log(`HostelMate API server: http://localhost:${port}`);
      });
    })
    .catch((error) => {
      console.error('Database initialization failed:', error);
      process.exitCode = 1;
    });
}

export { app, httpServer };
export default app;

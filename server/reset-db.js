import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const databaseFiles = [
  path.join(__dirname, 'hostelmate.sqlite'),
  path.join(__dirname, 'hostelmate.sqlite-shm'),
  path.join(__dirname, 'hostelmate.sqlite-wal'),
];

for (const file of databaseFiles) fs.rmSync(file, { force: true });
const { dbReady, closeDatabase } = await import('./db.js');
await dbReady;
await closeDatabase();
console.log('Đã tạo lại database sạch. Tài khoản mặc định: admin / 123456');

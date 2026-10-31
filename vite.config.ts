import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.API_PROXY_TARGET || 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  test: { include: ['src/**/*.test.ts'] },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/socket.io': { target: apiTarget, changeOrigin: true, ws: true },
    },
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3002,
    proxy: {
      // Dev proxy: both Express legacy (/api/v1) and Supabase Edge Functions
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/functions': {
        target: 'http://localhost:54321',
        changeOrigin: true,
      },
    },
  },
});

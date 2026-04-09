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
  build: {
    // Long-term cached vendor chunks. The point is that React, Supabase,
    // Tiptap, Leaflet etc. change rarely, so once a user has them cached
    // a redeploy of the app code does NOT invalidate them.
    //
    // Tiptap, Leaflet and qrcode are also lazy-imported via React.lazy on
    // the routes that use them, so users who never visit a wizard or the
    // map page never download those chunks at all.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          // Only split the truly heavy, isolatable libraries. Each of these
          // is only imported from a lazy route, so the chunk will only be
          // fetched on demand the first time the user opens that route.
          if (id.includes('@tiptap') || id.includes('prosemirror')) return 'vendor-tiptap';
          if (id.includes('leaflet')) return 'vendor-leaflet';
          if (id.includes('qrcode')) return 'vendor-qrcode';
          if (id.includes('@supabase')) return 'vendor-supabase';
          // React, react-dom, react-router, scheduler and any small deps
          // share a single 'vendor' chunk. Splitting them further triggers
          // circular chunk warnings in Rollup because of internal imports
          // (e.g. scheduler being pulled in from react-dom).
          return 'vendor';
        },
      },
    },
    // Raise the warning threshold a bit — vendor-react alone is ~140kB,
    // which is fine because it's cached forever after first visit.
    chunkSizeWarningLimit: 600,
  },
});

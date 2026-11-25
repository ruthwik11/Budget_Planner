import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5180, strictPort: true },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/[\/](react|react-dom|react-router|scheduler)[\/]/.test(id)) return 'react';
          if (/[\/](framer-motion|motion-dom|motion-utils|gsap|lenis)[\/]/.test(id)) return 'motion';
          if (/[\/](recharts|d3-[^\/]+|victory-vendor|lodash)[\/]/.test(id)) return 'charts';
          if (/[\/](react-hook-form|zod|@hookform)[\/]/.test(id)) return 'forms';
          if (/[\/]lucide-react[\/]/.test(id)) return 'icons';
        },
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});

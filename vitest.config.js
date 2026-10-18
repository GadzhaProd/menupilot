import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// UI tests only. The calculation and store tests run on node:test (npm run test:core).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    include: ['test/ui/**/*.test.{ts,tsx}'],
    setupFiles: ['test/ui/setup.ts'],
  },
});

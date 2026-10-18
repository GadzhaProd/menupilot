import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages serves the project from https://gadzhaprod.github.io/menupilot/,
// so every build/preview (mode "production") uses that sub-path; `vite dev` uses "/".
export default defineConfig(({ mode }) => ({
  base: mode === 'development' ? '/' : '/menupilot/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
}));

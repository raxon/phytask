import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { manifest: true },
  server: {
    proxy: {
      '/sessions': 'http://127.0.0.1:3000',
      '/signal-stream': 'http://127.0.0.1:3000',
    },
  },
});

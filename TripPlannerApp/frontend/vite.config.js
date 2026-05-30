import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // expose on LAN so other devices can connect
    port: 5173,
  },
  resolve: {
    alias: {
      // Ensures leaflet images resolve correctly
    },
  },
});

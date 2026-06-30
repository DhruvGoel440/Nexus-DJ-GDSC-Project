import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Handles BOTH standard API calls and nested WebSocket upgrades (like /api/v2/ws)
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        ws: true, // <-- THIS IS THE CRITICAL MISSING LINK
      }
    }
  }
})
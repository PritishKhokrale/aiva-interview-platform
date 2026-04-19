import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: '0.0.0.0',   // expose to local network (phones, tablets on same Wi-Fi)
    allowedHosts: true, // allow ngrok tunnelling
    proxy: {
      // Node.js backend (auth, meetings, socket)
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
      // Python Flask AI service (interview engine, resume parsing, reports)
      '/api/py': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/py/, '/api'),
      },
    },
  },
})

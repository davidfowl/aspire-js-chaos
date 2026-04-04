import { defineConfig } from 'vite'

const apiTarget = process.env.API_HTTPS || process.env.API_HTTP || 'http://localhost:3001';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
      }
    }
  }
})

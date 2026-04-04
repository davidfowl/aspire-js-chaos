import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const apiTarget = process.env.API_HTTPS || process.env.API_HTTP || 'http://localhost:3001';

export default defineConfig({
  plugins: [vue()],
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

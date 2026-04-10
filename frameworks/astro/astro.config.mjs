// @ts-check
import { defineConfig } from 'astro/config';

const apiTarget = process.env.API_HTTPS || process.env.API_HTTP || 'http://localhost:3001';

// https://astro.build/config
export default defineConfig({
  vite: {
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        }
      }
    }
  }
});

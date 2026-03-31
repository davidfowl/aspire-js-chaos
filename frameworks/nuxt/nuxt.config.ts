export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  nitro: {
    preset: 'node-server'
  },
  runtimeConfig: {
    apiUrl: '' // overridden by NUXT_API_URL env var
  }
})

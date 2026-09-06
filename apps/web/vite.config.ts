import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

/* The local server (apps/server, port 8787) serves no CORS headers on purpose:
   in dev the SPA reaches it through this proxy, so `VITE_ADA_SERVER=/` is
   same-origin and nothing else has to be configured. Point ADA_SERVER at
   another host to proxy that one instead. */
const server = process.env.ADA_SERVER ?? 'http://localhost:8787'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': { target: server, changeOrigin: true },
      '/ws': { target: server.replace(/^http/, 'ws'), ws: true, changeOrigin: true },
    },
  },
})

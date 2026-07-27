import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
  server: {
    port: 2200,
    // Permit ngrok tunnel hosts (harmless for local dev); otherwise Vite returns
    // "Blocked request" when the app is opened via an *.ngrok URL.
    allowedHosts: ['.ngrok-free.app', '.ngrok.app', '.ngrok-free.dev', '.ngrok.io', '.loca.lt'],
    // HMR websocket over an https tunnel must target port 443. Only applied when
    // running under `npm run dev:tunnel`, so local HMR is unaffected.
    ...(process.env.NGROK_TUNNEL === '1'
      ? { hmr: { clientPort: 443, protocol: 'wss' as const } }
      : {}),
    proxy: {
      // Dev: same-origin calls to /api are proxied to the NestJS backend,
      // so no CORS is needed locally. Prod builds use VITE_API_URL instead.
      '/api': {
        target: 'http://localhost:3300',
        changeOrigin: true,
      },
      // The Socket.IO engine path is `/socket.io/`, which is NOT under `/api` and NOT under
      // the backend's `/api/v1` global prefix (the gateway attaches to the raw HTTP server),
      // so it needs its own entry or every dev handshake 404s.
      //
      // `ws: true` is MANDATORY — without it the polling handshake proxies fine and the
      // upgrade to WebSocket dies at the dev server, which looks like a mysterious
      // reconnect loop rather than a proxy bug.
      //
      // `changeOrigin` rewrites `Host`, NOT `Origin`, so the backend still sees
      // `http://localhost:2200` — which is what its `CORS_ORIGIN` allowlist / CSWSH
      // `Origin` check expects.
      '/socket.io': {
        target: 'http://localhost:3300',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})

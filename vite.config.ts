import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * The bundle's own version, compiled in.
 *
 * ⚠️ THIS IS THE HALF THAT MUST NOT NEED A NETWORK CALL. The version screen exists to be readable
 * at the exact moment every request to the backend is failing — that is the situation somebody
 * opens it in. An endpoint answering "which app am I running?" would go dark precisely when the
 * question is asked, so the app states its own version from a build-time constant and asks the
 * server only for the server's. The asymmetry is the design, and it is documented on the backend's
 * `SystemController` from the other side.
 *
 * `version` is read from `package.json` rather than duplicated here: one number, one home, and
 * `npm version` keeps working.
 *
 * ⚠️ BOTH CONSTANTS ARE FROZEN WHEN THIS CONFIG LOADS. Bumping `package.json` while `npm run dev`
 * is running does NOT change what the app reports — config evaluation is not part of HMR — so the
 * version screen keeps showing the old number and, against a backend that already moved, reports
 * a mismatch that does not exist in the files. Measured during the 0.3.0 bump. Restart the dev
 * server after a bump; a production build re-evaluates this every time and is never affected.
 */
const appVersion = (JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string })
  .version

/**
 * The short commit of this build, or `unknown` — the same word the backend uses for the same fact,
 * so the two rows of the version card read alike when neither was stamped.
 *
 * `+dirty` is not decoration. A dev build carries uncommitted work by definition, and a build id
 * naming a commit whose files are not what is running is worse than no build id at all: the whole
 * point of the string is that someone can check out that commit and see this behaviour. Anything
 * that fails here — no git, a tarball, a detached worktree — falls back rather than breaking the
 * build, because a version stamp must never be able to stop a deploy.
 */
function gitBuild(): string {
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim()
  try {
    return git('rev-parse', '--short', 'HEAD') + (git('status', '--porcelain') ? '+dirty' : '')
  } catch {
    return 'unknown'
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    // JSON.stringify, not the bare value: `define` performs a TEXT substitution, so an unquoted
    // `0.3.0` would be spliced into the source as an expression and fail to parse.
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_BUILD__: JSON.stringify(gitBuild()),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@tests': fileURLToPath(new URL('./tests', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    css: true,
    // Tests live outside `src/` so the source tree stays production-only.
    // `tests/helpers/` and `tests/setup.ts` are infrastructure, not suites —
    // the globs below match only real spec files so they aren't collected.
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/e2e/**/*.e2e.{ts,tsx}'],
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

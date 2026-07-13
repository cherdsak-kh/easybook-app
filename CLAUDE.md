# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`easybook-app` is the frontend for EasyBook: a standalone React + Vite + TypeScript + Tailwind SPA
designed to run inside **LINE LIFF**. It talks to the backend (`easybook-service`, a separate NestJS
repo) over `/api/v1`. It runs on port **2200**; the backend runs on port **3300**.

## Commands

```bash
npm install
cp .env.example .env.local   # set VITE_LIFF_ID (optional in a plain browser)

npm run dev          # start dev server on :2200 (proxies /api -> :3300)
npm run build         # tsc -b && vite build
npm run preview       # preview the production build
npm run test          # vitest run (single run)
npm run test:watch    # vitest (watch mode)
npm run lint          # oxlint
npm run gen:api       # regenerate src/lib/api-types.ts from the backend's OpenAPI spec
```

To run a single test file: `npx vitest run src/components/HealthStatus.test.tsx`.
To run tests matching a name: `npx vitest run -t "renders the ok status"`.

## Architecture

### API types are generated, not hand-written

`src/lib/api-types.ts` is generated via `openapi-typescript` from the backend's live OpenAPI spec
(`npm run gen:api`, requires the backend running on `:3300`). It is **committed** so this repo builds
without the backend running. After any backend contract change, regenerate this file rather than
hand-editing it.

`src/lib/api-client.ts` wraps the generated types in a typed `openapi-fetch` client (`api`). Add new
typed request helpers here (following the `getHealth` pattern) rather than calling `fetch` directly
elsewhere.

- Dev: `VITE_API_URL` is empty → same-origin `/api/...` calls hit the Vite proxy to `:3300` (no CORS
  needed locally).
- Prod: `VITE_API_URL` is set to the backend origin.

### LIFF integration is isolated and fails soft

`src/lib/liff.ts` wraps `@line/liff` behind `initLiff()`, which **never throws** — it resolves to
`null` when `VITE_LIFF_ID` is unset, the user isn't logged in, or LIFF init fails for any reason.
Callers (e.g. `HomePage`) treat `null` as "anonymous" and fall back to generic behavior. Preserve this
fail-soft contract when touching LIFF code: the app must remain usable in a plain dev browser with no
LIFF id configured.

### Path alias

`@/*` maps to `src/*` (defined in both `vite.config.ts` and `tsconfig.app.json` — keep them in sync
if changed). Use `@/...` imports rather than relative `../../` paths.

### Testing

Vitest + Testing Library + jsdom, configured in `vite.config.ts` (`test` block) with globals enabled
(no need to import `describe`/`it`/`vi`). `src/test/setup.ts` registers `@testing-library/jest-dom`
matchers.

Convention used throughout: mock dependency modules at the import boundary with `vi.mock('@/lib/...')`
rather than mocking `fetch`/network calls directly — see `HealthStatus.test.tsx` and
`HomePage.test.tsx` for the pattern (mock the `lib` module, assert on rendered states: loading /
ok / error).

### Styling

Tailwind v4 via the `@tailwindcss/vite` plugin (no separate `tailwind.config.js` — config is
CSS-driven from `src/index.css`). Support both light and dark mode with `dark:` variants, matching
existing components.

## Environment variables

Copy `.env.example` to `.env.local`.

- `VITE_API_URL` — backend origin for production builds. Leave empty in dev (uses the Vite proxy).
- `VITE_LIFF_ID` — LINE LIFF app id from the LINE Developers console. Leave empty to run in a plain
  browser with a generic fallback greeting.

## Notes

- `vite.config.ts` allows `*.ngrok-free.app`/`.loca.lt` hosts and adjusts HMR when `NGROK_TUNNEL=1` is
  set, for testing the app through a tunnel (e.g. from the actual LINE app).
- Node >=20 is required (`.nvmrc` pins `20`).
- `.npmrc` sets `legacy-peer-deps=true`.

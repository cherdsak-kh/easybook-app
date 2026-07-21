# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`easybook-app` is the frontend for EasyBook. It is **one Vite SPA serving two different portals**
with two different audiences, split by URL:

- **Client portal** (`/*` → `HomePage`, `RegistrationForm`) — the public LINE **LIFF** surface end
  users see inside the LINE app. Anonymous, fail-soft, mixed Thai/English copy.
- **Backend portal** (`/backend/*`) — the internal back-office for staff: cookie-session login,
  forced password change, and a dashboard shell (`line-users` / `options` / `staff` / `profile`).

It talks to the backend (`easybook-service`, a separate NestJS repo) over `/api/v1`. It runs on port
**2200**; the backend runs on port **3300**.

## Commands

```bash
npm install
cp .env.example .env.local   # set VITE_LIFF_ID (optional in a plain browser)

npm run dev          # start dev server on :2200 (proxies /api -> :3300)
npm run build         # tsc -b && vite build   (tsc -b IS the type-check; there is no `typecheck` script)
npm run preview       # preview the production build
npm run test          # vitest run (single run)
npm run test:watch    # vitest (watch mode)
npm run lint          # oxlint
npm run gen:api       # regenerate src/lib/api-types.ts from the backend's OpenAPI spec (backend must be up on :3300)
```

There is **no `typecheck` script** — `tsc -b` (via `npm run build`, or `tsc -b --force` alone) is the
real type gate. The IDE may bundle an older TypeScript than the installed one (6.x); verify a
compiler-option warning against `node_modules/typescript` before "fixing" a tsconfig to silence it.

To run a single test file: `npx vitest run src/pages/admin/LineUsersPage.test.tsx`.
To run tests matching a name: `npx vitest run -t "renders the ok status"`.

A husky pre-commit hook runs `lint-staged`: for staged `*.{ts,tsx}` it runs oxlint, then
`vitest related --run` — i.e. only the tests **related to the staged files**, not the full suite, so
commits stay fast. A red related-test blocks the commit by design. Run the full suite yourself with
`npm test` (or in CI) before merging.

## Architecture

### API types are generated, not hand-written

`src/lib/api-types.ts` is generated via `openapi-typescript` from the backend's live OpenAPI spec
(`npm run gen:api`, requires the backend running on `:3300`). It is **committed** so this repo builds
without the backend running. After any backend contract change, regenerate this file rather than
hand-editing it.

`src/lib/api-client.ts` wraps the generated types in a typed `openapi-fetch` client (`api`). Add new
typed request helpers here (following the existing pattern) rather than calling `fetch` directly
elsewhere.

- Dev: `VITE_API_URL` is empty → same-origin `/api/...` calls hit the Vite proxy to `:3300` (no CORS
  needed locally).
- Prod: `VITE_API_URL` is set to the backend origin.

### Two portals, one router

`App.tsx` mounts the backend portal branch first and the client portal `/*` catch-all **last**, so
React Router's specificity ranking lets the portal win and `/*` only catches non-portal paths.

`src/constants/routes.ts` is the single source of the portal's **URL** paths: `PORTAL_BASE = '/backend'`
and everything derives from it, so rebasing the whole back-office is a one-line edit. **These are
`react-router` paths, not API paths** — never import `routes.ts` into `api-client.ts`. The backend's
admin surface lives at `/auth/system/*` and `/api/v1/system-users` ("system", never "admin"); the two
namespaces are unrelated and coupling them breaks auth.

### Back-office auth: cookie session + CSRF (client portal is anonymous)

The backend portal authenticates with an **httpOnly cookie session** issued by the backend — the
frontend never reads or stores a token. This is wired in three places that must stay consistent:

- `api-client.ts` sets `credentials: 'include'` and installs a **CSRF middleware**: it fetches
  `GET /auth/system/csrf` once, caches the in-flight promise, attaches the token as the `x-csrf-token`
  header on every unsafe verb (POST/PUT/PATCH/DELETE, double-submit), and invalidates + retries **once**
  on a 403. A 401 is the session-dead signal that bounces to login; a 403 is CSRF/forbidden. Never send
  the CSRF token as a body field.
- `src/auth/AuthProvider.tsx` holds session state and probes `GET /auth/system/me` **once** on mount
  (a 401 there is a normal "unauthenticated" outcome, not an error). `ProtectedRoute` gates the portal;
  `useAuth` exposes `{ status, user, login, logout, refresh, expireSession }`.
- `mustChangePassword` is authoritative **only** from `/me`, never from the login body — a user logging
  in with a temp password is re-probed via `/me` (which is exempt from the server-side force-reset gate)
  and routed to `ForcePasswordChangePage`. The frontend redirect is UX; the server gate is the control.

The **client portal is unauthenticated** and shares no session with the back-office. `src/lib/access-policy.ts`
mirrors the backend's ADMIN access-transition matrix purely so an ADMIN never *sees* a button that would
403 — the backend is still the authority.

### LIFF integration is isolated and fails soft

`src/lib/liff.ts` wraps `@line/liff` behind `initLiff()`, which **never throws** — it resolves to
`null` when `VITE_LIFF_ID` is unset, the user isn't logged in, or LIFF init fails for any reason.
Callers (e.g. `HomePage`) treat `null` as "anonymous" and fall back to generic behavior. Preserve this
fail-soft contract when touching LIFF code: the app must remain usable in a plain dev browser with no
LIFF id configured.

### Path alias

`@/*` maps to `src/*` (defined in both `vite.config.ts` and `tsconfig.app.json` — keep them in sync
if changed). Use `@/...` imports rather than relative `../../` paths.

### User-facing strings are centralized, and split by portal

Two `as const` dictionaries under `src/constants/`, so a component and its tests read the **same**
literal (copy was changed out-of-band while tests queried the old string, silently reddening the
suite):

- `ui-strings-backend.ts` — Backend Portal copy (`/backend/*`). Some values are template *formatters*
  (`(name) => string`) for interpolation.
- `ui-strings-client.ts` — Client/LIFF copy (`HomePage`, `RegistrationForm`), deliberately mixed
  Thai/English (product's current state, not drift).

**Do not import one dictionary from the other portal's components** — the separation is what keeps a
back-office re-word from ever reaching an end user's screen. Neither is i18n: no locale, no `t()`
lookup. Don't grow either into a locale system without a plan that asks for one.

### Testing

Vitest + Testing Library + jsdom, configured in `vite.config.ts` (`test` block) with globals enabled
(no need to import `describe`/`it`/`vi`). `src/test/setup.ts` registers `@testing-library/jest-dom`
matchers.

Convention used throughout: mock dependency modules at the import boundary with `vi.mock('@/lib/...')`
rather than mocking `fetch`/network calls directly — see `HealthStatus.test.tsx` and
`HomePage.test.tsx` for the pattern (mock the `lib` module, assert on rendered states: loading /
ok / error).

### Styling — daisyUI is the UI source of truth

Tailwind **v4** via the `@tailwindcss/vite` plugin (no `tailwind.config.js` — config is CSS-driven
from `src/index.css`: `@import "tailwindcss"; @plugin "daisyui";`). UI is built with **daisyUI 5**
(installed 5.6.x).

**Before generating or editing ANY component markup — buttons, tables, modals, inputs, badges, cards,
drawers, etc. — consult the `daisyui` skill** (`.claude/skills/daisyui`, the official daisyUI 5.6.x
reference; read the relevant `components/*.md`). This is a hard rule for humans and agents alike:
**never hand-roll component markup or invent generic class patterns from memory** — that improvisation
is the drift this rule exists to stop. The skill is the canonical *structure*; the conventions below
bind on top of it.

- **Semantic tokens only.** Style with daisyUI semantic classes/tokens (`bg-base-100`,
  `text-base-content`, `border-base-300`, `btn-primary`, `badge-success`, …), never hard-coded colors.
- **Theming is `data-theme`, NOT `dark:`.** Light/dark and per-portal identity come from the daisyUI
  themes declared in `index.css` (`easybook-client(-dark)`, `easybook-admin(-dark)`, `dashwind(-light|
  -dark)`), applied via a `data-theme` wrapper and the `@custom-variant dark` rule. **Ship zero `dark:`
  utilities in new code.** New/adjusted themes are additive `@plugin "daisyui/theme"` blocks appended
  to `index.css` — never edit the existing blocks or add a `tailwind.config.js`.
- **Accessibility still applies:** semantic HTML, sufficient contrast in every theme, visible focus,
  `aria-*` where daisyUI markup alone is insufficient.

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

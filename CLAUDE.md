# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`easybook-app` is the frontend for EasyBook. Today it is **one Vite SPA serving one surface**:

- **Client portal** (index `/` → `HomePage`, `RegistrationForm`) — the public LINE **LIFF** surface
  end users see inside the LINE app. Anonymous, fail-soft, mixed Thai/English copy.

## ⚠️ The back-office was deleted on 2026-08-16 — read this before looking for it

There is **no `/admin-portal` branch, no session, no guard and no admin components.** The old
back-office (its login, its guarded shell, its two wired pages, its 29 stub routes, four hooks,
four `lib/` modules, seven string modules and four daisyUI themes) was removed whole. An
`/admin-portal/*` URL is now a plain 404.

**Why it went early.** The plan called for building v2 to parity and then switching. That rule
exists to avoid losing a working capability mid-flight — and at `0.0.0` nobody was using this one,
so there was nothing to lose, while every backend contract change cost a round of repairs to a
portal already scheduled for deletion.

**What replaces it.** Admin Portal v2, built from
`docs/prototypes/admin-portal/master_layout_prototype_v2.html` in the parent repo, landing under
`src/admin-portal/` with its own routes, guard, session handling and theming. Plan and status:
`claude_planning/feature/20260815_2111_admin_portal_v2_build/`.

**What was deliberately KEPT**, because it binds to the API contract rather than to the old UI:

- `src/lib/api-client.ts` — every typed helper, including the ~25 back-office ones. They follow
  the generated types, cost nothing to hold, and v2 needs the same calls. Most are unreferenced
  until it arrives; that is expected, not dead code to prune.
- `src/lib/api-types.ts` — generated, and the reason the above stays honest.
- `src/pages/demo/*` — two self-contained mockups (`/demo/client`, `/demo/admin`) with no API, no
  session and no shared components. `/demo/admin` mocks the BOOKING domain, which does not exist
  yet, so it is not part of the deleted portal.

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

To run a single test file: `npx vitest run tests/unit/pages/client-portal/HomePage.test.tsx`.
To run tests matching a name: `npx vitest run -t "renders a healthy status"`.

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

### One router, one branch

`App.tsx` holds a single pathless `ThemeLayout portal="client"` wrapper containing the two demo
routes, the client index (`/` → `HomePage`) and the app's global `path="*"` → `NotFoundPage`, kept
LAST so it only catches genuinely unmatched URLs.

When v2 adds its branch back, one rule from the deleted version is worth carrying over: the route
constants are **`react-router` paths, not API paths** — never import them into `api-client.ts`. The
backend's admin surface lives at `/auth/system/*` and `/api/v1/system-users` ("system", never
"admin"); the two namespaces are unrelated and coupling them breaks auth.

### Components live in their portal's folder — HARD RULE

**Components used strictly by one portal belong in `src/components/<portal>/`. Genuinely shared
primitives belong in `src/components/shared/`.** PO mandate, not a preference. Today that means
`src/components/client-portal/` and `src/components/shared/` — do **not** open a new top-level
`src/components/<feature>/` bucket. Pages mirror the split under `src/pages/client-portal/`.

⚠️ **v2 does NOT follow this layout, deliberately.** It lives entirely under `src/admin-portal/`
with its own `components/` and `pages/` inside, so the whole back-office is one folder that can be
reasoned about — and, if it ever comes to it, removed — in one piece. The reasoning is in
`claude_planning/feature/20260815_2111_admin_portal_v2_build/CONVENTIONS.md` §4.

### Auth: the client portal is anonymous, and nothing else is authenticated yet

`src/auth/` was deleted with the back-office. The **client portal is unauthenticated** and shares no
session with the backend's `SystemUser` surface.

One piece of the wiring survives, in `api-client.ts`, and v2 should reuse rather than reinvent it: it
sets `credentials: 'include'` and installs a **CSRF middleware** that fetches `GET /auth/system/csrf`
once, caches the in-flight promise, attaches the token as the `x-csrf-token` header on every unsafe
verb (POST/PUT/PATCH/DELETE, double-submit), and invalidates + retries **once** on a 403. A 401 is the
session-dead signal; a 403 is CSRF/forbidden. **Never send the CSRF token as a body field** —
`forbidNonWhitelisted` would reject a `_csrf` body key with a 400 before the middleware ever saw it.

Two rules the deleted provider learned the hard way, recorded here so v2 does not rediscover them:

- **The session is an httpOnly cookie.** The frontend never reads or stores a token, and
  `GET /auth/system/me` is the only way to know whether one is live — a 401 there is a normal
  "unauthenticated" outcome, not an error.
- **`mustChangePassword` is authoritative only from `/me`**, never from the login response body: a
  user logging in with a temp password must be re-probed, and `/me` is exempt from the server-side
  force-reset gate precisely so that probe works. v2 DOES have a force-reset screen (the prototype
  designs one), which closes the accepted lockout the old portal shipped with.

### LIFF integration is isolated and fails soft

`src/lib/liff.ts` wraps `@line/liff` behind `initLiff()`, which **never throws** — it resolves to
`null` when `VITE_LIFF_ID` is unset, the user isn't logged in, or LIFF init fails for any reason.
Callers (e.g. `HomePage`) treat `null` as "anonymous" and fall back to generic behavior. Preserve this
fail-soft contract when touching LIFF code: the app must remain usable in a plain dev browser with no
LIFF id configured.

### Path alias

`@/*` maps to `src/*` (defined in both `vite.config.ts` and `tsconfig.app.json` — keep them in sync
if changed). Use `@/...` imports rather than relative `../../` paths.

### User-facing strings are centralized but modularized (per-feature)

`as const` string modules under `src/constants/`, one per feature/surface
(`ui-strings-<feature>.ts`), so a component and its tests read the **same** literal (copy was changed
out-of-band while tests queried the old string, silently reddening the suite).

**Exactly one module remains:** `ui-strings-client.ts` — `UI_STRINGS_CLIENT`, the client/LIFF copy
(`HomePage`, `RegistrationForm`), deliberately mixed Thai/English (the product's current state, not
drift). The other seven went with the back-office on 2026-08-16.

⚠️ **v2 does NOT use this pattern, and that is a PO ruling (`Q9`), not drift.** Its copy is written
INLINE in the page that renders it, so the PO can open one file and see the words next to the markup
they appear in — and so a port can be compared against the prototype line by line, which is the one
thing that port has to get right. The single exception is `admin-portal/labels.ts`: enum→Thai maps,
which are not copy but a translation of values the API sends, and which must have exactly one
spelling because `ผู้ดูแลระบบสูงสุด` appears on four different screens.

**Do not import a back-office string module from a client component, or vice versa** — the separation
is what keeps a back-office re-word from ever reaching an end user's screen. None of this is i18n: no
locale, no `t()` lookup. Don't grow any into a locale system without a plan that asks for one.

### Testing

Vitest + Testing Library + jsdom, configured in `vite.config.ts` (`test` block) with globals enabled
(no need to import `describe`/`it`/`vi`). `tests/setup.ts` registers `@testing-library/jest-dom`
matchers.

Tests live **outside** `src/`, mirroring the source hierarchy: unit specs in `tests/unit/**` (e.g.
`src/components/shared/HealthStatus.tsx` -> `tests/unit/components/shared/HealthStatus.test.tsx`), e2e specs in
`tests/e2e/**`, and shared fixtures/factories in `tests/helpers/` (imported via the `@tests/*`
alias). `src/` holds production code only. Vitest collects `tests/unit/**/*.test.{ts,tsx}` and
`tests/e2e/**/*.e2e.{ts,tsx}`, so files under `tests/helpers/` are never picked up as suites.

The suite is **4 files / 48 tests** — it was 18 / 426 until the back-office was deleted, and the
difference was all its. ⚠️ v2 does not rebuild that coverage: the PO's testing ruling for this
phase is **measure in the browser, do not write new unit tests** (the reasoning, and what it trades
away, are in the plan folder's `CONVENTIONS.md` §2). Keep the surviving specs green; do not read the
small number as permission to skip verification.

Convention used throughout: mock dependency modules at the import boundary with `vi.mock('@/lib/...')`
rather than mocking `fetch`/network calls directly — see `HealthStatus.test.tsx` and
`HomePage.test.tsx` for the pattern (mock the `lib` module, assert on rendered states: loading /
ok / error).

### Styling — daisyUI is the UI source of truth

Tailwind **v4** via the `@tailwindcss/vite` plugin (no `tailwind.config.js` — config is CSS-driven
from `src/index.css`: `@import "tailwindcss"; @plugin "daisyui";`). UI is built with **daisyUI 5**
(installed 5.6.x).

⚠️ **v2 is the exception to almost everything in this section.** It ports the prototype's
`@theme static` block and ~122 `@layer components` classes verbatim, because every value in them was
measured (row heights, 44px targets, contrast in both themes) and converting them to daisyUI
components is exactly where that fidelity would be lost. daisyUI stays as the **token provider**
(`base-100`, `base-content`, `primary`…), which the prototype already uses, so the two connect
directly.

**Before generating or editing ANY component markup — buttons, tables, modals, inputs, badges, cards,
drawers, etc. — consult the `daisyui` skill** (`.claude/skills/daisyui`, the official daisyUI 5.6.x
reference; read the relevant `components/*.md`). This is a hard rule for humans and agents alike:
**never hand-roll component markup or invent generic class patterns from memory** — that improvisation
is the drift this rule exists to stop. The skill is the canonical *structure*; the conventions below
bind on top of it.

- **Semantic tokens only.** Style with daisyUI semantic classes/tokens (`bg-base-100`,
  `text-base-content`, `border-base-300`, `btn-primary`, `badge-success`, …), never hard-coded colors.
- **Theming is `data-theme`, NOT `dark:`.** Light/dark and per-portal identity come from the themes
  available in `index.css`, applied via a `data-theme` wrapper and the `@custom-variant dark` rule:
  **two** are declared locally as `@plugin "daisyui/theme"` blocks (`easybook-client` and
  `easybook-client-dark`), and daisyUI **built-ins** are opted into by name on the
  `@plugin "daisyui" { themes: … }` invocation — currently `light --default` and
  `dark --prefersdark`. The four themes the back-office used (`easybook-admin(-dark)`,
  `dashwind(-light|-dark)`) and its `cupcake` opt-in were deleted with it on 2026-08-16; v2 brings
  its own tokens from the prototype rather than restoring them. **Ship zero `dark:` utilities in new
  code.** New/adjusted themes are additive
  `@plugin "daisyui/theme"` blocks appended to `index.css` — never edit the existing blocks or add a
  `tailwind.config.js`.
  - **`@custom-variant dark` is `[data-theme$="-dark"]`** (`index.css:10`), so any dark theme must be
    named with a `-dark` suffix or the variant silently stops matching.
  - A theme's `primary` is **not** guaranteed readable as text/border on its own `base-100` —
    `cupcake`'s measures 1.40:1. For focus rings, outline buttons and state borders use
    `base-content`, which is by definition the readable foreground for `base-100` in any theme.
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

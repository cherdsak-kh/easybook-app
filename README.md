# easybook-app (frontend)

EasyBook frontend — a standalone **React + Vite + TypeScript + Tailwind** SPA designed
to run inside **LINE LIFF**. Talks to the backend (`easybook-service`) over `/api/v1`;
its API types are **generated from the backend's OpenAPI spec**.

- **Backend repo:** `easybook-service` (NestJS)
- **Runs on port 2200**

## Stack
React 19 · Vite 8 · Tailwind v4 · `@line/liff` · `openapi-fetch` (typed client) +
`openapi-typescript` (codegen).

## Setup
```bash
npm install
cp .env.example .env.local   # set VITE_LIFF_ID (optional in a plain browser)
npm run dev                  # http://localhost:2200
```
The dev server proxies `/api` → the backend at `http://localhost:3300`.

## API types (OpenAPI codegen)
Types are generated from the running backend spec and **committed**
(`src/lib/api-types.ts`), so this repo builds without the backend:
```bash
# with the backend running on :3300
npm run gen:api
```
The typed client lives in `src/lib/api-client.ts` (`openapi-fetch`).

## Scripts
`dev` · `build` · `preview` · `test` / `test:watch` · `lint` · `gen:api`.

## Environment
`VITE_API_URL` (empty in dev → uses the proxy; set to the backend origin in prod) ·
`VITE_LIFF_ID` (LINE LIFF app id). See `.env.example`.

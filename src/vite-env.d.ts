/// <reference types="vite/client" />

/**
 * Build-time constants substituted by Vite's `define` (see `vite.config.ts`, which explains why
 * the app's own version is compiled in rather than fetched).
 *
 * ⚠️ These are TEXT SUBSTITUTIONS, not variables — nothing declares them at runtime. Referencing
 * one from a file Vite does not transform (a plain `node` script, a `.mjs` config) throws
 * `__APP_VERSION__ is not defined` at the point of use, and the failure is at run time, not build
 * time, because TypeScript sees the declaration below and is satisfied.
 */
declare const __APP_VERSION__: string
declare const __APP_BUILD__: string

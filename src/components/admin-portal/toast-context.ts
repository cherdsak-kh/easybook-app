import { createContext } from 'react'

/**
 * Shared types + the React context for the admin portal's ONE toast surface.
 *
 * Split out of `ToastProvider.tsx` for the same reason `src/auth/auth-context.ts` is split
 * out of `AuthProvider.tsx`: a `.tsx` file that exports both a component and a
 * hook/constant breaks React Fast Refresh (oxlint's `react(only-export-components)`), so
 * the component file exports ONLY components.
 */

/**
 * The rule the toast exists to enforce (plan §7, and QA checks it): a **transient outcome
 * of an action the user just took** is a toast; the **persistent state of the thing on
 * screen** is an inline alert. "Unify the toasts" is NOT "convert every alert into a
 * toast" — a field-level validation error or a login failure must stay beside the control
 * it describes, and moving it into a corner would be a regression.
 */
export type ToastTone = 'success' | 'error' | 'info' | 'warning'

export interface ToastMessage {
  readonly id: number
  readonly message: string
  readonly tone: ToastTone
}

/** How long a toast stays up before dismissing itself. */
export const TOAST_TIMEOUT_MS = 4000

/**
 * How many toasts may be on screen at once. They STACK (that is what daisyUI's `toast`
 * wrapper is for) rather than replacing one another, but an unbounded stack could cover
 * the viewport, so the oldest is dropped past this many.
 */
export const TOAST_STACK_LIMIT = 3

/** Tone → daisyUI `alert` colour token. Never a hard-coded colour. */
export const TOAST_TONE_CLASS: Readonly<Record<ToastTone, string>> = {
  success: 'alert-success',
  error: 'alert-error',
  info: 'alert-info',
  warning: 'alert-warning',
}

export interface ToastApi {
  /** Queue a toast. Defaults to the success tone. */
  show: (message: string, tone?: ToastTone) => void
  /** Remove a toast immediately (the close button, or a caller that supersedes it). */
  dismiss: (id: number) => void
}

export const ToastContext = createContext<ToastApi | null>(null)

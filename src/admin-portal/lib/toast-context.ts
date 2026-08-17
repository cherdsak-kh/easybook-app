/**
 * The toast context and its hook, split from `Toast.tsx` so that file exports components
 * only (Fast Refresh — see `use-busy.ts` for the same reason).
 */

import { createContext, useContext } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

export const ToastContext = createContext<((kind: ToastKind, message: string) => void) | null>(null)

/**
 * `toast('error', '…')`. Throws outside the provider rather than silently no-op'ing: a
 * swallowed toast is an outcome the operator never learns, which is the exact failure the
 * component exists to prevent.
 */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

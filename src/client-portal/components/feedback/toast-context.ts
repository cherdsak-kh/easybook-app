import { createContext, useContext } from 'react'

/**
 * The toast channel, split out of `Toast.tsx` so that file exports components only — a module
 * exporting both a component and a hook loses React Fast Refresh for everything in it.
 */

export type ToastKind = 'info' | 'success' | 'warning' | 'error'

export type ShowToast = (text: string, kind?: ToastKind) => void

export const ToastContext = createContext<ShowToast | null>(null)

/**
 * Reads the toast function.
 *
 * ⚠️ THROWS RATHER THAN NO-OPING when the provider is missing. This portal is real-time
 * throughout, and its toasts carry things like "your request was auto-rejected because the slot
 * was taken" — a portal whose notices silently go nowhere looks exactly like one where nothing
 * has happened, which is the worst possible failure for this particular channel.
 */
export function useToast(): ShowToast {
  const show = useContext(ToastContext)
  if (!show) {
    throw new Error('useToast must be used inside <ToastProvider>')
  }
  return show
}

// The ONE toast surface for the admin portal. It is the `AdminPortalProfilePage`
// save-success toast, extracted rather than rewritten (PO decision OPEN-5): no toast
// dependency is installed, and none may be — daisyUI is this repo's documented UI source
// of truth, and a third-party toast renders its own non-daisyUI DOM and its own colours,
// which would need `data-theme` token bridging to look right in either theme.
//
// Markup is daisyUI-canonical (skill: components/toast.md, components/alert.md,
// components/button.md): a `toast` positioning wrapper stacking one `alert` per message.
// Semantic tokens only; zero `dark:` utilities (theming is `data-theme`).
//
// Types, constants and the context live in `toast-context.ts`, and the hook in
// `useToast.ts`, so this file exports ONLY components (React Fast Refresh) — the same
// three-file split `src/auth/` uses.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { TOAST_STRINGS } from '@/constants/ui-strings-toast'
import {
  TOAST_STACK_LIMIT,
  TOAST_TIMEOUT_MS,
  TOAST_TONE_CLASS,
  ToastContext,
  type ToastApi,
  type ToastMessage,
  type ToastTone,
} from './toast-context'

/**
 * Holds the toast queue and renders the fixed top-center stack.
 *
 * Position is `toast-center toast-top` — top-center — for EVERY toast (PO decision OPEN-8,
 * moved here from the original top-right). The bottom of the viewport is where the
 * LINE-users pager and the per-row actions live, so a bottom toast would cover the control
 * the operator just clicked. This also supersedes the profile page's previous
 * `toast-bottom` placement; that is the point of "unify".
 *
 * Mounted once, in `AdminPortalLayout`, so every in-shell page shares one queue and one
 * design.
 */
export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly ToastMessage[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback((message: string, tone: ToastTone = 'success') => {
    // The id is read OUTSIDE the updater so the updater stays pure (React StrictMode
    // invokes it twice in development).
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, message, tone }].slice(-TOAST_STACK_LIMIT))
  }, [])

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toasts.length > 0 && (
        <div className="toast toast-center toast-top z-50">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

/**
 * One toast.
 *
 * Announced, not just drawn. A success/info/warning uses `role="status"` +
 * `aria-live="polite"` so a screen reader reports it WITHOUT stealing focus; an error
 * uses `role="alert"` (assertive), because a failed write is worth interrupting for.
 *
 * It both auto-dismisses after {@link TOAST_TIMEOUT_MS} and carries a real, labelled
 * close button, so it can never become a permanent obstruction and never disappears
 * before a keyboard/screen-reader user can act on it.
 *
 * The auto-dismiss timer lives HERE rather than in the provider so unmounting the toast —
 * whether by the close button or by being pushed off the end of {@link TOAST_STACK_LIMIT}
 * — clears its timer through the effect's own cleanup. There is no timer map to leak.
 *
 * Motion: daisyUI's toast entry animation is already wrapped in
 * `@media (prefers-reduced-motion: no-preference)`, so reduced-motion users get the toast
 * with no slide, for free.
 */
function ToastItem({
  toast,
  onDismiss,
}: {
  readonly toast: ToastMessage
  readonly onDismiss: (id: number) => void
}) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  const isError = toast.tone === 'error'

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`alert ${TOAST_TONE_CLASS[toast.tone]}`}
    >
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={TOAST_STRINGS.dismiss}
        className="btn btn-ghost btn-circle btn-xs transition-colors focus-visible:ring-2 focus-visible:ring-primary"
      >
        ✕
      </button>
    </div>
  )
}

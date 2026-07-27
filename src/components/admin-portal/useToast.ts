import { useContext } from 'react'
import { ToastContext, type ToastApi } from './toast-context'

/**
 * The toast API for the current subtree.
 *
 * Throws outside a `<ToastProvider>` **on purpose** (same contract as `useAuth`): a silent
 * no-op default would turn "this screen forgot to mount the provider" into "the
 * confirmation just never appears", which is precisely the class of silent failure this
 * project bans. Tests that render a page in isolation must wrap it in the provider.
 */
export function useToast(): ToastApi {
  const api = useContext(ToastContext)
  if (!api) {
    throw new Error('useToast must be used within a <ToastProvider>.')
  }
  return api
}

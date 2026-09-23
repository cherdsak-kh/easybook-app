import type { ReactNode } from 'react'
import { GateContext } from '@/client-portal/hooks/gate-context'
import { useLiffGate } from '@/client-portal/hooks/useLiffGate'

/**
 * Runs the gate once for the whole client surface and publishes the result.
 *
 * ⚠️ IT WRAPS THE LAYOUT ROUTE'S ELEMENT, NOT THE `<Routes>`. React Router keeps a layout route's
 * element mounted while its children change, so the checks run once per session rather than once
 * per navigation — and the 404, which sits outside the layout, never starts a LIFF init for a URL
 * this portal does not own.
 *
 * ⚠️ A provider that also consumed its own context would be a component reading a value it has
 * not published yet, so the shell is a separate component underneath rather than this file doing
 * both jobs.
 */
export function GateProvider({ children }: { children: ReactNode }) {
  const value = useLiffGate()
  return <GateContext.Provider value={value}>{children}</GateContext.Provider>
}

/**
 * Zone 1's data, held by the PAGE rather than the card: the incident form needs the server's
 * version for its diagnostics, and a second `/system/version` call from the form would be a second
 * answer to a question the card already asked.
 *
 * One probe on entry and one per `recheck()`, each reading BOTH existing endpoints
 * (`getSystemHealth`, `getSystemVersion`). ⚠️ The LINE and R2 verdicts are server-cached (300 s,
 * 60 s after a failure), so a recheck re-reads but does not force a fresh probe — accepted in the
 * plan, and why there is no cache-busting parameter: no role can hammer LINE from this button.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { getSystemHealth, getSystemVersion } from '@/lib/api-client'
import type { ProbeState } from './support-model'

export function useSupportHealth() {
  const [state, setState] = useState<ProbeState>({ phase: 'loading' })
  // A late answer from a superseded probe (or an unmounted page) must not overwrite a newer one.
  // `invalidate` rather than `latest.current++` in the cleanup: the hooks lint flags a ref read there.
  const latest = useRef(0)
  const invalidate = useCallback(() => {
    latest.current++
  }, [])

  const check = useCallback(async () => {
    const mine = ++latest.current
    setState({ phase: 'loading' })
    const [health, version] = await Promise.all([
      // `getSystemHealth` throws on any failure; the card renders that as a state, not an error.
      getSystemHealth().catch(() => null),
      getSystemVersion(),
    ])
    if (mine === latest.current) setState({ phase: 'done', health, version })
  }, [])

  useEffect(() => {
    void check()
    return () => {
      invalidate()
    }
  }, [check, invalidate])

  return { state, pending: state.phase === 'loading', recheck: check }
}

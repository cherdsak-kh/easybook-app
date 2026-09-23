/**
 * The `ข้อความตอบกลับด่วน` card's own state (ANNOUNCE-UI-6 D-5, design §2.3) — the
 * `use-announcement-departments` pattern: `seq`, `alive` and `loaded` refs.
 *
 * ⚠️ INDEPENDENT OF THE PAGE. One GET on mount, in parallel with the list, the counts and the bot
 * info. It never waits on them and they never wait on it: a failed canned list leaves the rest of
 * the page working, and vice versa.
 *
 * ⚠️ ONLY THE NEWEST READ MAY WRITE (`seq`). StrictMode sends the mount GET twice, a retry and a
 * post-mutation reconcile can overlap, and an older answer landing last would put back a stale list.
 *
 * ⚠️ A READ THAT FAILS AFTER A SUCCESS KEEPS THE ROWS, silently (D-4). The toast has already confirmed
 * the user's own change; replacing a usable list with an error would help nobody.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { listCannedReplies, type CannedReply } from './canned-replies-api'
import { applyChange, type CannedChange } from './canned-reply-outcomes'

export type CannedState =
  | { status: 'loading' }
  /** `retrying` — ลองอีกครั้ง is in flight; the failure (and its focused button) stays on screen. */
  | { status: 'failed'; retrying: boolean }
  | { status: 'ok'; rows: readonly CannedReply[] }

export interface CannedReplies {
  state: CannedState
  /** ลองอีกครั้ง: `failed` → `failed{retrying:true}`, then read. Never back to `loading`. */
  retry: () => void
  /**
   * Apply `change` to the rows NOW, then GET to reconcile. It NEVER sets `loading`, so the skeleton
   * never comes back and rows stay where they are. The GET bumps `seq`, so any read already in
   * flight (which may predate the write) is dropped.
   */
  commit: (change: CannedChange) => void
}

export function useCannedReplies(): CannedReplies {
  const [state, setState] = useState<CannedState>({ status: 'loading' })
  const seq = useRef(0)
  const loaded = useRef(false)
  /** A read can resolve after the page was left. */
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const read = useCallback(async () => {
    const mine = ++seq.current
    const r = await listCannedReplies()
    if (!alive.current || mine !== seq.current) return
    if (r.ok) {
      loaded.current = true
      setState({ status: 'ok', rows: r.value })
    } else if (!loaded.current) {
      // Any status (401 included — the session dialog sits on top, design S-8) or no response.
      // Read through the REF, not the state, so this callback does not depend on what it sets.
      setState({ status: 'failed', retrying: false })
    }
  }, [])

  useEffect(() => {
    void read()
  }, [read])

  const retry = useCallback(() => {
    setState((s) => (s.status === 'failed' ? { status: 'failed', retrying: true } : s))
    void read()
  }, [read])

  const commit = useCallback(
    (change: CannedChange) => {
      if (change.kind !== 'none') {
        setState((s) => (s.status === 'ok' ? { status: 'ok', rows: applyChange(s.rows, change) } : s))
      }
      void read()
    },
    [read],
  )

  return { state, retry, commit }
}

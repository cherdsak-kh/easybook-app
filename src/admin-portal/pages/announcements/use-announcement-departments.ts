/**
 * The กลุ่ม/ฝ่าย list the compose dialog offers — `GET /api/v1/departments`, fetched on every open.
 *
 * ⚠️ RE-FETCHED ON EVERY OPEN (plan D-9, the `use-staff-options` rule). The dialog is re-keyed per
 * open, so "once when `enabled` first becomes true" IS once per open. A list cached from an earlier
 * open would still offer a department soft-deleted since, which the server answers with a 400.
 *
 * ⚠️ A VIEWER NEVER CALLS IT, and neither does `view` mode. The route is `@Roles(SUPER_ADMIN, ADMIN)`
 * and would answer 403; `view` renders the name from `record.department` instead (AC-6).
 *
 * ⚠️ ONLY THE NEWEST READ MAY WRITE (`seq`). The ลองอีกครั้ง button and the two department-400 paths
 * can put a second read in flight; an older one landing last would put back a stale list. A refresh
 * that FAILS after a success keeps the rows it has — replacing a usable list with an error helps
 * nobody (the `use-staff-options` rule).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { listDepartments, type Department } from '@/lib/api-client'

export type DeptState =
  | { status: 'loading' }
  /** `retrying` — ลองอีกครั้ง is in flight; the failure (and its focused button) stays on screen. */
  | { status: 'failed'; retrying: boolean }
  | { status: 'ok'; rows: readonly Department[] }

export interface AnnouncementDepartments {
  state: DeptState
  /**
   * Every name any read has returned, by id. A department that drops out of a re-read (the 400 path)
   * still has a name to show as `(ไม่พร้อมใช้งาน)` rather than an empty control (design §1.4).
   */
  seen: Readonly<Record<number, string>>
  refresh: () => void
}

export function useAnnouncementDepartments(enabled: boolean): AnnouncementDepartments {
  const [state, setState] = useState<DeptState>({ status: 'loading' })
  const [seen, setSeen] = useState<Readonly<Record<number, string>>>({})
  const seq = useRef(0)
  const loaded = useRef(false)
  /** A read can resolve after the dialog that asked for it was re-keyed away. */
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const fetchList = useCallback(async () => {
    const mine = ++seq.current
    try {
      const rows = await listDepartments()
      if (!alive.current || mine !== seq.current) return
      loaded.current = true
      setState({ status: 'ok', rows })
      setSeen((prev) => {
        const next = { ...prev }
        for (const r of rows) next[r.id] = r.name
        return next
      })
    } catch {
      if (!alive.current || mine !== seq.current) return
      // Read through the REF, not the state, so this callback does not depend on what it sets.
      if (!loaded.current) setState({ status: 'failed', retrying: false })
    }
  }, [])

  useEffect(() => {
    if (enabled) void fetchList()
  }, [enabled, fetchList])

  const refresh = useCallback(() => {
    if (!enabled) return
    setState((s) => (s.status === 'failed' ? { status: 'failed', retrying: true } : s))
    void fetchList()
  }, [enabled, fetchList])

  return { state, seen, refresh }
}

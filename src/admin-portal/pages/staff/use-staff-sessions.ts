/**
 * One row's session summary for เซสชันและความปลอดภัย — `GET /system-users/:id/sessions` (E5).
 *
 * ⚠️ `id === null` MEANS "DO NOT ASK", and that is the whole access rule on this side. The caller
 * passes an id only for a SUPER_ADMIN looking at a row that is not deleted; for an ADMIN or a VIEWER
 * it is always `null`, so no request is ever made (it would 403, and the section is not drawn).
 *
 * The result carries the id it answers for. A dialog that moves from one row to another renders once
 * with the previous row's summary before the effect runs — without the stamp that frame would print
 * somebody else's IP address under this person's name.
 *
 * The page re-keys the fetch by closing and reopening the dialog (null → id), which is how a force
 * sign-out shows its own result: the count is read again from the server, never patched locally.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { getStaffSessions, type StaffSessionSummary } from '@/lib/api-client'

type Result =
  | { id: string; status: 'loading' }
  | { id: string; status: 'error' }
  | { id: string; status: 'ok'; data: StaffSessionSummary }

export type StaffSessionsFetch =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ok'; data: StaffSessionSummary }

export function useStaffSessions(id: string | null): StaffSessionsFetch & { reload: () => void } {
  const [result, setResult] = useState<Result | null>(null)
  /** Only the newest request may write — closing and reopening quickly must not land an old answer. */
  const latest = useRef(0)

  const load = useCallback(async (target: string) => {
    const mine = ++latest.current
    setResult({ id: target, status: 'loading' })
    try {
      const data = await getStaffSessions(target)
      if (mine === latest.current) setResult({ id: target, status: 'ok', data })
    } catch {
      if (mine === latest.current) setResult({ id: target, status: 'error' })
    }
  }, [])

  useEffect(() => {
    if (id === null) {
      // Forget the answer too, so reopening the SAME row starts at `loading` instead of flashing the
      // count it had before a force sign-out for the frame before the refetch begins.
      latest.current++
      setResult(null)
      return
    }
    void load(id)
  }, [id, load])

  const reload = useCallback(() => {
    if (id !== null) void load(id)
  }, [id, load])

  if (id === null) return { status: 'idle', reload }
  if (result === null || result.id !== id) return { status: 'loading', reload }
  if (result.status === 'ok') return { status: 'ok', data: result.data, reload }
  return { status: result.status, reload }
}

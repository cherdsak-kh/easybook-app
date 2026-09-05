/**
 * The two vocabularies `สร้างคำจองสถานที่` needs and the queue behind it does not: the LINE users a
 * booking may be raised FOR, and the กลุ่ม/ฝ่าย a manually-typed requester may be filed under.
 *
 * ⚠️ REBUILT ON EVERY OPEN, NEVER CACHED ACROSS THEM — the prototype's own rule for this dialog. The
 * ALLOWED set changes on การลงทะเบียน, and a list snapshotted at mount would offer an account that
 * was blocked this morning. `openKey` is bumped by the page each time the dialog opens; `0` means
 * "never opened", and nothing is fetched until it is.
 *
 * ⚠️ THE TWO LISTS FAIL INDEPENDENTLY, and that is the whole reason they are not one `Promise.all`
 * with one error. A department list that will not load must not take the requester picker with it —
 * กลุ่ม/ฝ่าย is OPTIONAL on this form, so a booking can still be raised without one, while a missing
 * user list means mode (A) cannot be used at all and the operator has to be told to switch modes.
 *
 * ⚠️ `GET /line-users` IS PAGED AND CAPS `limit` AT 100, so this walks the pages. The walk is capped
 * too (`MAX_PAGES`): a school that has grown past a thousand approved accounts needs a server-side
 * search on this field, not a bigger loop, and `truncated` is what will say so out loud rather than
 * letting the last operator quietly become unfindable.
 */

import { useEffect, useState } from 'react'
import { listDepartments, listLineUsers, type Department, type LineUser } from '@/lib/api-client'

/** `GET /line-users` refuses anything over 100 with a 400 rather than clamping. */
const PAGE_SIZE = 100

/** 1,000 accounts. See the header for what happens past it. */
const MAX_PAGES = 10

export const USERS_FAILED = 'โหลดรายชื่อผู้ใช้ LINE ไม่สำเร็จ · เลือก “ระบุข้อมูลเอง” เพื่อกรอกผู้ขอจองแทนได้'
export const DEPARTMENTS_FAILED = 'โหลดรายชื่อกลุ่ม/ฝ่ายไม่สำเร็จ · บันทึกต่อได้โดยไม่ระบุกลุ่ม/ฝ่าย'

export interface CreateOptions {
  /** `null` while the first load of this open is in flight. */
  users: LineUser[] | null
  usersError: string | null
  /** True when the school has more approved accounts than `MAX_PAGES × PAGE_SIZE`. */
  usersTruncated: boolean
  departments: Department[] | null
  departmentsError: string | null
}

async function fetchAllowedUsers(): Promise<{ rows: LineUser[]; truncated: boolean }> {
  // `sort: 'name'` because this is a picker, not a queue: the operator is looking up a person they
  // already have in mind, and "most recently registered" is not an order anybody searches in.
  const first = await listLineUsers({ access: 'ALLOWED', sort: 'name', limit: PAGE_SIZE, page: 1 })
  const rows = [...first.data]
  const pages = Math.min(first.meta.totalPages, MAX_PAGES)
  for (let page = 2; page <= pages; page += 1) {
    const next = await listLineUsers({ access: 'ALLOWED', sort: 'name', limit: PAGE_SIZE, page })
    rows.push(...next.data)
  }
  return { rows, truncated: first.meta.totalPages > MAX_PAGES }
}

export function useCreateOptions(openKey: number): CreateOptions {
  const [users, setUsers] = useState<LineUser[] | null>(null)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [usersTruncated, setUsersTruncated] = useState(false)
  const [departments, setDepartments] = useState<Department[] | null>(null)
  const [departmentsError, setDepartmentsError] = useState<string | null>(null)

  useEffect(() => {
    if (openKey === 0) return
    let live = true

    // Back to the loading state on every reopen, deliberately: showing the PREVIOUS open's list
    // while this one is being fetched is how a blocked account stays selectable for one more click.
    setUsers(null)
    setUsersError(null)
    setUsersTruncated(false)

    void (async () => {
      try {
        const { rows, truncated } = await fetchAllowedUsers()
        if (!live) return
        setUsers(rows)
        setUsersTruncated(truncated)
      } catch {
        if (!live) return
        setUsers([])
        setUsersError(USERS_FAILED)
      }
    })()

    void (async () => {
      try {
        const rows = await listDepartments()
        if (!live) return
        setDepartments(rows)
        setDepartmentsError(null)
      } catch {
        if (!live) return
        setDepartments([])
        setDepartmentsError(DEPARTMENTS_FAILED)
      }
    })()

    return () => {
      live = false
    }
  }, [openKey])

  return { users, usersError, usersTruncated, departments, departmentsError }
}

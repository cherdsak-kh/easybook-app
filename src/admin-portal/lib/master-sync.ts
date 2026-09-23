/**
 * Keeping the four curated option lists fresh in a dialog that stays open (#ISSUE-11).
 *
 * ตำแหน่ง · กลุ่ม/ฝ่าย · ประเภทสถานที่ · สิ่งอำนวยความสะดวก are read by four dialogs, and each one used to
 * fetch them exactly once, on open. An operator who opened เพิ่มบัญชี, switched tabs to add a
 * missing ตำแหน่ง on การตั้งค่าระบบ and came back found the dropdown still without it — the only way
 * out was closing the dialog and losing everything typed. Three triggers close that gap, and each
 * covers a case the other two miss:
 *
 *   · `MASTER_UPDATED` on a BroadcastChannel — another TAB of this app wrote an option. Arrives at
 *     once, before the operator even comes back.
 *   · `visibilitychange` → visible, and window `focus` — the write happened somewhere a channel
 *     cannot reach: another browser, another operator, another machine.
 *   · `onOpen` on `Combobox` — the operator is about to look at the list, which is the moment it
 *     has to be right.
 *
 * ⚠️ REVALIDATE, NEVER RELOAD. Every consumer keeps the list it has while the new one is in flight:
 * no skeleton, no disabled control, no reset of the value already chosen. A refresh the operator
 * did not ask for must not be visible unless it brings something new.
 *
 * ⚠️ THE CHANNEL DOES NOT ECHO INSIDE ONE TAB, and that is deliberate. A BroadcastChannel object
 * never receives its own posts, and this module holds ONE object per tab for both directions — so a
 * write in this tab reaches the others only. The tab that wrote has already put the row into its
 * own list (that is what the inline-create paths do), so a same-tab echo would be a second request
 * for an answer it already holds.
 */

import { useEffect, useRef } from 'react'
import { ApiError } from '@/lib/api-client'

/** The four tables. Same literals as `OptionModel`, which is structurally assignable to this. */
export type MasterEntity = 'personnelRole' | 'department' | 'venueType' | 'amenity'

interface MasterMessage {
  type: 'MASTER_UPDATED'
  entity: MasterEntity
}

const CHANNEL_NAME = 'easybook_master_sync'

/**
 * Focus and visibility typically fire as a PAIR on an ordinary tab switch, a few milliseconds apart
 * and in either order depending on the browser. Without this they would be two identical requests
 * for one return. (Not measured here — the window is generous on purpose.)
 */
const RETURN_COALESCE_MS = 500

let channel: BroadcastChannel | null = null
const listeners = new Set<(entity: MasterEntity) => void>()

function isMessage(data: unknown): data is MasterMessage {
  if (!data || typeof data !== 'object') return false
  const m = data as Partial<MasterMessage>
  return (
    m.type === 'MASTER_UPDATED' &&
    (m.entity === 'personnelRole' ||
      m.entity === 'department' ||
      m.entity === 'venueType' ||
      m.entity === 'amenity')
  )
}

/**
 * The one channel, opened on first use and kept for the life of the tab.
 *
 * ⚠️ `null` WHERE THE API DOES NOT EXIST — an old WebView, or a test environment. Everything that
 * reads this degrades to focus/visibility/onOpen, which still keep the list correct; they are just
 * later than a broadcast would have been.
 */
function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME)
      channel.onmessage = (e: MessageEvent) => {
        if (!isMessage(e.data)) return
        for (const fn of listeners) fn(e.data.entity)
      }
    } catch {
      channel = null
    }
  }
  return channel
}

/** Tell every OTHER tab that one of the option tables changed. Never throws. */
export function broadcastMasterUpdated(entity: MasterEntity): void {
  const ch = getChannel()
  if (!ch) return
  try {
    const message: MasterMessage = { type: 'MASTER_UPDATED', entity }
    ch.postMessage(message)
  } catch {
    /* a closed or unsupported channel is not a reason to fail the write that already succeeded */
  }
}

/** Subscribe to other tabs' writes. Returns the unsubscribe. */
export function subscribeMasterUpdated(fn: (entity: MasterEntity) => void): () => void {
  getChannel()
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/**
 * While `active`, call `revalidate` whenever the operator returns to this tab or another tab writes
 * one of `entities`. Everything is removed the moment `active` goes false or the caller unmounts.
 *
 * ⚠️ `revalidate` IS READ THROUGH A REF, so the listeners are attached once per open rather than
 * once per render — a caller passing an inline arrow would otherwise tear them down and re-add them
 * on every keystroke in the form.
 *
 * ⚠️ `entities` IS COMPARED BY CONTENT, NOT IDENTITY, for the same reason: callers pass a literal.
 */
export function useMasterRevalidation(
  active: boolean,
  entities: readonly MasterEntity[],
  revalidate: () => void,
): void {
  const latest = useRef(revalidate)
  useEffect(() => {
    latest.current = revalidate
  })

  const key = entities.join('|')

  useEffect(() => {
    if (!active) return
    const wanted = new Set(key.split('|'))
    let lastReturn = 0

    const onReturn = () => {
      const now = Date.now()
      if (now - lastReturn < RETURN_COALESCE_MS) return
      lastReturn = now
      latest.current()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onReturn()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onReturn)
    const unsubscribe = subscribeMasterUpdated((entity) => {
      if (wanted.has(entity)) latest.current()
    })

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onReturn)
      unsubscribe()
    }
  }, [active, key])
}

/**
 * The toast for an inline create that did not land.
 *
 * ⚠️ EVERY SENTENCE ENDS BY SAYING THE FORM IS STILL THERE, because that is the question an operator
 * has after a failure inside a half-filled dialog — "did I just lose all of that?" — and the answer is
 * the reason this feature exists.
 *
 * ⚠️ A 409 IS NOT ALWAYS A ROW THE OPERATOR CAN SEE. Uniqueness is the partial index over active
 * rows, so the name can belong to a reserved row this role never receives, or to one another tab
 * added since the list was fetched. The sentence therefore says "มีอยู่ในระบบแล้ว" and points at the
 * search — it does not claim the row is in the list below. Callers revalidate on a 409 too, which
 * is what puts the second case on screen.
 */
export function inlineCreateError(err: unknown, noun: string, name: string): string {
  const status = err instanceof ApiError ? err.status : 0
  if (status === 409) {
    return `มี${noun}ชื่อ “${name}” อยู่ในระบบแล้ว · ค้นหาจากรายการแทน หรือใช้ชื่ออื่น · ข้อมูลในฟอร์มยังอยู่ครบ`
  }
  if (status === 403) return `บัญชีของคุณเพิ่ม${noun}ไม่ได้ · ข้อมูลในฟอร์มยังอยู่ครบ`
  if (status === 400 && err instanceof ApiError && err.message) {
    return `เพิ่ม${noun}ไม่สำเร็จ: ${err.message} · ข้อมูลในฟอร์มยังอยู่ครบ`
  }
  if (status === 0) {
    return `เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ยังไม่ได้เพิ่ม${noun} · ข้อมูลในฟอร์มยังอยู่ครบ ลองใหม่อีกครั้ง`
  }
  return `เพิ่ม${noun}ไม่สำเร็จ · ข้อมูลในฟอร์มยังอยู่ครบ ลองใหม่อีกครั้ง`
}

/** Whether a failed create is worth a revalidate — only a 409 means the list is behind. */
export const isConflict = (err: unknown): boolean => err instanceof ApiError && err.status === 409

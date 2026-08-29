/**
 * `สถานที่จัดกิจกรรม` — `/backend/venues`.
 *
 * The product's subject. Everything else in this portal is paperwork arranged around this table, and
 * it is the first screen here that is a GRID OF CARDS rather than a table. That is not a style
 * choice: a venue has a PHOTO, and the photo is the field a person actually decides on. Sixty rows
 * of 44px text with a thumbnail in column two would be a table that happens to contain images; this
 * is a list whose primary column IS the image.
 *
 * ── The list is fetched WHOLE and filtered on the client ──
 * ⚠️ `GET /venues` ACCEPTS `?q=`, `?venueTypeId=` AND `?status=`, AND THIS SCREEN USES NONE OF THEM.
 * Not an oversight — the endpoint returns everything (no pagination, by design), so the rows are
 * already here. Round-tripping per keystroke would be slower, would need a debounce, and would open
 * the gap the count bar exists to close: a footer counting one array while the grid renders another.
 * The parameters are the contract's, for the LIFF surface and for whatever asks next.
 *
 * ── Two filters, and why exactly two ──
 * ประเภท is the reason ประเภทสถานที่ was built at all; a category nobody can filter by is a label.
 * สถานะ answers "what is shut right now", the one question this page gets asked that the cards
 * cannot answer at a glance once there is more than a screenful. There is deliberately no ความจุ
 * filter: a range control is the third-biggest thing in the toolbar, and "at least N people" belongs
 * on the LIFF booking form, where somebody actually knows N.
 *
 * ── Nine rows today, and nine is not a ceiling ──
 * A school adds venues, so nothing here is built around the number — which is why the empty,
 * no-match and loading states all exist for a list that currently cannot be empty.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ApiError,
  closeVenue,
  createVenue,
  deleteVenue,
  listVenues,
  patchVenue,
  reopenVenue,
  type Venue,
} from '@/lib/api-client'
import { Btn } from '../../components/ui/Btn'
import { ConfirmModal } from '../../components/feedback/ConfirmModal'
import { EmptyState } from '../../components/feedback/EmptyState'
import { LoadError, type LoadErrorKind } from '../../components/feedback/LoadError'
import { PageHeading } from '../../components/shell/PageHeading'
import { Skeleton, SkeletonRegion } from '../../components/feedback/Skeleton'
import { useAcl } from '../../lib/use-acl'
import { useAuth } from '../../lib/auth-context'
import { useToast } from '../../lib/toast-context'
import { VenueCard, VenueCardSkeleton } from './components/VenueCard'
import {
  VenueFormDialog,
  type VenueFieldErrors,
  type VenueFormMode,
  type VenueFormValues,
} from './components/VenueFormDialog'
import { useVenueVocabularies } from './use-venue-vocabularies'
import type { AdminRoute } from '../../routes'

const ICON = {
  refresh:
    'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99',
  plus: 'M12 4.5v15m7.5-7.5h-15',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  building:
    'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
} as const

function Glyph({ d, className = 'h-4.5 w-4.5 shrink-0' }: { d: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

/**
 * ── ขนาดการ์ด ──
 * One number per level, and the column count is whatever fits — nothing here says "4". The same
 * three values behave sensibly on a 13" laptop and on an ultrawide without a second table of
 * breakpoints to keep in step.
 *
 * ⚠️ CALIBRATED AGAINST THE PO'S 1920px SCREEN, not against a 1440 pane. A first attempt used
 * 300/240/190 because 240 gives four columns at 1440 — on 1920 the same 240 gives SIX. The card area
 * is 1572px there and 1092px at 1440, a 44% difference, so "how many fit" is not a property of the
 * value.
 *   1920 → 3 / 4 / 6 columns   ·   1440 → 2 / 3 / 4   ·   1024 → 1 / 1 / 2
 *
 * ⚠️ `sm` WAS 260px FOR ONE REVISION AND THAT MADE IT A DEAD SEGMENT at 1440: 300 and 260 both land
 * on three columns there, so two of the three buttons did the same thing. No three values give three
 * distinct counts at every width — the tracks quantise — so the spread keeps all three distinct
 * across 1440–1920, and 1024 is where ใหญ่/กลาง collapse instead.
 */
const ZOOM = { lg: '380px', md: '300px', sm: '240px' } as const
type ZoomLevel = keyof typeof ZOOM
const ZOOM_KEY = 'easybook-admin-venue-zoom'
const ZOOM_LABEL: Record<ZoomLevel, string> = {
  lg: 'การ์ดใหญ่',
  md: 'การ์ดกลาง',
  sm: 'การ์ดเล็ก',
}

const isZoom = (v: string | null): v is ZoomLevel => v === 'lg' || v === 'md' || v === 'sm'

/**
 * ⚠️ THE CHOICE PERSISTS (localStorage, same as the theme). Density is a property of the person and
 * their screen, not of the visit; resetting it on every entry would make the control feel broken to
 * the one operator who set it deliberately.
 */
function readZoom(): ZoomLevel {
  try {
    const v = localStorage.getItem(ZOOM_KEY)
    return isZoom(v) ? v : 'md'
  } catch {
    return 'md'
  }
}

/** The three grid glyphs, as `<rect>` sets rather than paths. */
const ZOOM_RECTS: Record<ZoomLevel, { x: number; y: number; s: number; r: number }[]> = {
  lg: [3.5, 13].flatMap((y) => [3.5, 13].map((x) => ({ x, y, s: 7.5, r: 1.5 }))),
  md: [3.5, 9.5, 15.5].flatMap((y) => [3.5, 9.5, 15.5].map((x) => ({ x, y, s: 5, r: 1 }))),
  sm: [3.5, 8.7, 13.9].flatMap((y) => [3.5, 8.7, 13.9].map((x) => ({ x, y, s: 3.6, r: 0.8 }))),
}

function ZoomGlyph({ level }: { level: ZoomLevel }) {
  return (
    <svg
      aria-hidden="true"
      className="h-4.5 w-4.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      viewBox="0 0 24 24"
    >
      {ZOOM_RECTS[level].map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.s} height={r.s} rx={r.r} />
      ))}
    </svg>
  )
}

/** `ApiError` → which of the three error panels. */
const kindOf = (err: unknown): LoadErrorKind => {
  const status = err instanceof ApiError ? err.status : 0
  if (status === 0) return 'network'
  if (status === 403) return 'forbidden'
  return 'server'
}

/** Whole-form failures that leave the dialog open with everything typed intact. */
const WRITE_FAIL: Record<number, string> = {
  403: 'เซสชันความปลอดภัยหมดอายุ ยังไม่ได้บันทึกอะไร โปรดรีเฟรชหน้าแล้วลองใหม่',
  503: 'ระบบขัดข้องชั่วคราว ยังไม่ได้บันทึกอะไร ลองใหม่อีกครั้ง',
  0: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ยังไม่ได้บันทึกอะไร ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่',
}

type Pending =
  | { kind: 'close'; venue: Venue }
  | { kind: 'reopen'; venue: Venue }
  | { kind: 'delete'; venue: Venue }

export function VenuesPage({ route }: { route: AdminRoute }) {
  const { user } = useAuth()
  const acl = useAcl(user!.role)
  const toast = useToast()

  const [rows, setRows] = useState<Venue[] | null>(null)
  const [error, setError] = useState<LoadErrorKind | null>(null)
  const [term, setTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [zoom, setZoom] = useState<ZoomLevel>(readZoom)
  /** Bumped on every reload so the vocabularies refetch alongside the list. */
  const [reloadKey, setReloadKey] = useState(0)

  const [form, setForm] = useState<{ mode: VenueFormMode; target: Venue | null } | null>(null)
  const [formAlert, setFormAlert] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<VenueFieldErrors>({})
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)

  const { assignableTypes, amenities, alert: vocabAlert } = useVenueVocabularies(reloadKey)

  const load = useCallback(async () => {
    setError(null)
    try {
      setRows(await listVenues())
    } catch (err) {
      setRows(null)
      setError(kindOf(err))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const reload = () => {
    setReloadKey((k) => k + 1)
    void load()
  }

  // `useMemo`, not `rows ?? []` inline: a fresh array every render makes every downstream `useMemo`
  // recompute, which is the whole reason those exist.
  const all = useMemo(() => rows ?? [], [rows])

  /**
   * ⚠️ THE TOMBSTONE APPEARS IN THIS FILTER, AND ONLY WHILE IT HOLDS SOMETHING.
   *
   * Deleting a category promises the operator they can re-file its venues one at a time. Measured
   * against the built screen, that promise was unkeepable: the orphaned venues were reachable only
   * by scrolling the whole grid looking for a grey badge. It is NOT in the FORM's select — filing a
   * venue into the tombstone on purpose would make it mean two different things.
   */
  const orphanCount = all.filter((v) => v.venueType.isFallback).length
  const fallbackType = all.find((v) => v.venueType.isFallback)?.venueType ?? null

  const trimmed = term.trim().toLowerCase()
  const shown = useMemo(
    () =>
      all.filter((v) => {
        if (trimmed && !`${v.name} ${v.location ?? ''}`.toLowerCase().includes(trimmed)) {
          return false
        }
        if (typeFilter && v.venueType.id !== Number(typeFilter)) return false
        if (statusFilter === 'open' && !v.isOpen) return false
        if (statusFilter === 'closed' && v.isOpen) return false
        return true
      }),
    [all, trimmed, typeFilter, statusFilter],
  )

  const anyFilter = Boolean(trimmed || typeFilter || statusFilter)
  const closedShown = shown.filter((v) => !v.isOpen).length

  const applyZoom = (level: ZoomLevel) => {
    setZoom(level)
    try {
      localStorage.setItem(ZOOM_KEY, level)
    } catch {
      /* a private-mode browser refusing storage is not a reason to break the control */
    }
  }

  const clearFilters = () => {
    setTerm('')
    setTypeFilter('')
    setStatusFilter('')
  }

  const openCreate = () => {
    // The FK is required, so with no category there is no venue to create. Saying so here beats
    // opening a form with an empty select and a 400 waiting at the end of it.
    if (assignableTypes.length === 0) {
      toast(
        'error',
        'ยังไม่มีประเภทสถานที่ในระบบ — เพิ่มอย่างน้อยหนึ่งประเภทที่หน้า ประเภทสถานที่ ก่อน',
      )
      return
    }
    setFieldErrors({})
    setFormAlert(null)
    setForm({ mode: 'create', target: null })
  }

  /** The card does not know the role and should not have to — this decides which mode opens. */
  const openRecord = (venue: Venue) => {
    setFieldErrors({})
    setFormAlert(null)
    setForm({ mode: acl.write ? 'edit' : 'view', target: venue })
  }

  const closeForm = () => {
    setForm(null)
    setFieldErrors({})
    setFormAlert(null)
  }

  const submit = async (values: VenueFormValues) => {
    if (!form) return
    setFieldErrors({})
    setFormAlert(null)

    // Client-side checks first, so the operator is not made to wait for a round trip to be told a
    // field is empty. The server repeats every one of them.
    if (!values.name) {
      setFieldErrors({ name: 'กรอกชื่อสถานที่' })
      return
    }
    // ⚠️ THIS GUARD WAS DEAD CODE UNTIL 29 ส.ค. 2569, and nothing about it changed to fix that —
    // the DIALOG did. `VenueFormDialog` used to pre-select `types[0]` on create, so `venueTypeId`
    // was never empty and this branch could not be reached; the create form's default state was a
    // category nobody had chosen. It now opens on an empty placeholder, `Number('')` is `NaN`, and
    // `!NaN` is true — so an untouched select stops here instead of filing the venue under whichever
    // ประเภทสถานที่ happens to sort first.
    if (!values.venueTypeId) {
      setFieldErrors({ venueTypeId: 'เลือกประเภทสถานที่' })
      return
    }
    if (!values.capacity || values.capacity < 1) {
      setFieldErrors({ capacity: 'กรอกความจุเป็นตัวเลขอย่างน้อย 1 คน' })
      return
    }

    const body = {
      name: values.name,
      venueTypeId: values.venueTypeId,
      capacity: values.capacity,
      // `''` clears the column — the DTO turns an empty string into null, so this sends the
      // operator's "I emptied this field" rather than storing a blank string beside a null.
      location: values.location,
      description: values.description,
      amenityIds: values.amenityIds,
      photoUrls: values.photoUrls,
    }

    setBusy(true)
    try {
      if (form.target) await patchVenue(form.target.id, body)
      else await createVenue(body)
      await load()
      // A rename or a category change can move the row out of the current filters, and the operator
      // would then watch their own edit vanish. Drop the filters rather than the feedback.
      clearFilters()
      closeForm()
      toast(
        'success',
        form.target ? `บันทึกการแก้ไข ${values.name} แล้ว` : `เพิ่มสถานที่ ${values.name} แล้ว`,
      )
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0
      if (status === 409) {
        // A FIELD error, not a banner: the offending value is in that box and the fix is to change
        // it. A soft-deleted name is reusable, so a collision cannot be predicted from what is on
        // screen.
        setFieldErrors({ name: `มีสถานที่ชื่อ “${values.name}” อยู่แล้ว ใช้ชื่ออื่น` })
      } else if (status === 404) {
        setFormAlert(
          'สถานที่นี้ถูกลบไปแล้วโดยผู้ใช้คนอื่น ข้อมูลที่แก้ไว้ยังอยู่ในฟอร์ม แต่บันทึกไม่ได้',
        )
        await load()
      } else if (status === 400) {
        // The category or an amenity stopped being assignable while the dialog was open — somebody
        // deleted it on การตั้งค่าระบบ. Refetching the vocabularies is what makes the next attempt
        // possible rather than a repeat of the same 400.
        setFormAlert(
          'ประเภทสถานที่หรืออุปกรณ์ที่เลือกไว้ถูกลบไปแล้ว โปรดเลือกใหม่แล้วบันทึกอีกครั้ง',
        )
        setReloadKey((k) => k + 1)
      } else {
        setFormAlert(WRITE_FAIL[status] ?? WRITE_FAIL[503])
      }
    } finally {
      setBusy(false)
    }
  }

  /**
   * The three write-immediately actions, all routed through `ConfirmModal`.
   *
   * ⚠️ THE FORM STAYS OPEN UNDERNEATH, unlike every other confirm in this portal. These are reached
   * from INSIDE a form the operator is still filling in and they touch none of those fields —
   * closing แก้ไขสถานที่ for good would discard a half-typed rename as a side effect of a switch
   * that has nothing to do with the name.
   */
  const runPending = async (reason: string) => {
    if (!pending) return
    const { kind, venue } = pending
    try {
      const updated =
        kind === 'close'
          ? await closeVenue(venue.id, reason)
          : kind === 'reopen'
            ? await reopenVenue(venue.id)
            : (await deleteVenue(venue.id), null)

      await load()
      setPending(null)

      if (kind === 'delete') {
        // A deleted venue has no record left to edit, so this is the one of the three that DOES
        // close the form.
        closeForm()
        toast('success', `ลบ ${venue.name} แล้ว`)
        return
      }
      // Re-point the open dialog at the row the server just returned, so the badge, the reason line
      // and the knob all repaint from the write — without touching a single typed field.
      setForm((f) => (f && updated ? { ...f, target: updated } : f))
      toast(
        'success',
        kind === 'close' ? `ปิด ${venue.name} ชั่วคราวแล้ว` : `เปิดให้จอง ${venue.name} แล้ว`,
      )
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0
      setPending(null)
      await load()
      const fail =
        kind === 'close'
          ? `ปิด ${venue.name} ไม่สำเร็จ — สถานที่นี้ยังเปิดให้จองอยู่ ลองใหม่อีกครั้ง`
          : kind === 'reopen'
            ? `เปิด ${venue.name} ไม่สำเร็จ — สถานที่นี้ยังปิดอยู่ ลองใหม่อีกครั้ง`
            : `ลบ ${venue.name} ไม่สำเร็จ — สถานที่นี้ยังอยู่ในระบบ ลองใหม่อีกครั้ง`
      toast(
        'error',
        status === 404
          ? `สถานที่นี้ถูกลบไปแล้ว รายการถูกปรับให้ตรงกับข้อมูลล่าสุด`
          : status === 409
            ? `สถานะของสถานที่นี้ถูกเปลี่ยนโดยผู้ใช้คนอื่นแล้ว รายการถูกปรับให้ตรงกับข้อมูลล่าสุด`
            : fail,
      )
      if (status === 404) closeForm()
    }
  }

  const target = form?.target ?? null
  /** How many venues stay in this venue's category after it goes — the ประเภทสถานที่ card moves. */
  const siblingsAfterDelete =
    pending?.kind === 'delete'
      ? all.filter(
          (v) => v.venueType.id === pending.venue.venueType.id && v.id !== pending.venue.id,
        ).length
      : 0

  return (
    <div className="card-shell" style={{ ['--vn-card' as string]: ZOOM[zoom] }}>
      <PageHeading
        route={route}
        desc="รายการสถานที่ที่เปิดให้จองผ่าน LINE พร้อมรูปภาพ ความจุ และสิ่งอำนวยความสะดวก"
        descAtEveryWidth={false}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reload}
              aria-label="รีเฟรช"
              data-tip="รีเฟรช"
              data-tip-pos="bottom"
              className="flex min-h-11 items-center gap-2 rounded-control border border-base-content/20 bg-base-100 px-3 text-[14px] font-medium text-base-content/80 transition-colors hover:border-info/40 hover:bg-info/10 hover:text-info focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-4"
            >
              <Glyph d={ICON.refresh} />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>
            {acl.write && (
              <Btn variant="primary" onClick={openCreate}>
                <Glyph d={ICON.plus} />
                เพิ่มสถานที่
              </Btn>
            )}
          </div>
        }
      />

      <div className="card-shell rounded-card border border-base-300/70 bg-base-100 shadow-e1">
        <div className="flex shrink-0 flex-col gap-2.5 border-b border-base-300 p-3 sm:gap-3 sm:p-4 lg:flex-row lg:items-center lg:p-5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control border border-transparent bg-base-200 px-4 transition-all focus-within:border-primary/40 focus-within:bg-base-100 focus-within:ring-4 focus-within:ring-primary/10">
            <Glyph d={ICON.search} className="h-5 w-5 shrink-0 text-base-content/60" />
            <label className="sr-only" htmlFor="vn-search">
              ค้นหาจากชื่อสถานที่หรือที่ตั้ง
            </label>
            <input
              id="vn-search"
              type="search"
              placeholder="ค้นหาจากชื่อสถานที่หรือที่ตั้ง"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck
              enterKeyHint="search"
              className="min-h-11 w-full min-w-0 border-none bg-transparent text-[15px] text-base-content/90 outline-none placeholder:text-base-content/70"
            />
          </div>

          <div className="flex gap-2.5 sm:gap-3">
            <label className="relative flex min-w-0 flex-1 items-center rounded-control border border-transparent bg-base-200 pl-3.5 pr-3 transition-all focus-within:border-primary/40 focus-within:bg-base-100 focus-within:ring-4 focus-within:ring-primary/10 lg:flex-none">
              <span className="sr-only">กรองตามประเภทสถานที่</span>
              <select
                className="form-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">ทุกประเภท</option>
                {assignableTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
                {orphanCount > 0 && fallbackType && (
                  <option value={fallbackType.id}>
                    {fallbackType.name} ({orphanCount})
                  </option>
                )}
              </select>
              <Glyph
                d="M19 9l-7 7-7-7"
                className="pointer-events-none absolute right-3 h-4 w-4 text-base-content/60"
              />
            </label>

            <label className="relative flex min-w-0 flex-1 items-center rounded-control border border-transparent bg-base-200 pl-3.5 pr-3 transition-all focus-within:border-primary/40 focus-within:bg-base-100 focus-within:ring-4 focus-within:ring-primary/10 lg:flex-none">
              <span className="sr-only">กรองตามสถานะ</span>
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">ทุกสถานะ</option>
                <option value="open">เปิดให้จอง</option>
                <option value="closed">ปิดชั่วคราว</option>
              </select>
              <Glyph
                d="M19 9l-7 7-7-7"
                className="pointer-events-none absolute right-3 h-4 w-4 text-base-content/60"
              />
            </label>

            {/* Hidden below `lg`, and that is the whole justification for it being an icon strip
                rather than a third <select>: on a phone the grid is one column at every level, so
                the control would be three buttons that visibly do nothing. It appears exactly where
                it starts to mean something.

                A `radiogroup`, not three toggles — the levels are mutually exclusive and
                `aria-checked` says so, which three independent `aria-pressed` buttons would not. */}
            <div
              role="radiogroup"
              aria-label="ขนาดการ์ด"
              className="hidden shrink-0 items-center gap-0.5 rounded-control bg-base-200 p-1 lg:flex"
            >
              {(Object.keys(ZOOM) as ZoomLevel[]).map((level, i, levels) => (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={zoom === level}
                  aria-label={ZOOM_LABEL[level]}
                  data-tip={ZOOM_LABEL[level]}
                  data-tip-pos="bottom"
                  className="vn-zoom"
                  onClick={() => applyZoom(level)}
                  // Arrow keys move between segments, which is what `role="radiogroup"` promises.
                  // Without this the group announces itself as a radio group and then behaves like
                  // three unrelated buttons.
                  onKeyDown={(e) => {
                    const d =
                      e.key === 'ArrowRight' || e.key === 'ArrowDown'
                        ? 1
                        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                          ? -1
                          : 0
                    if (!d) return
                    e.preventDefault()
                    const next = levels[(i + d + levels.length) % levels.length]
                    applyZoom(next)
                    const el = e.currentTarget.parentElement?.children[
                      (i + d + levels.length) % levels.length
                    ] as HTMLElement | undefined
                    el?.focus()
                  }}
                >
                  <ZoomGlyph level={level} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {error ? (
          <div className="card-shell">
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
              <LoadError kind={error} onRetry={reload} />
            </div>
          </div>
        ) : rows === null ? (
          <LoadingPanel />
        ) : (
          <div className="card-shell">
            <div className="card-scroll nav-scroll">
              {/* ⚠️ THREE OUTCOMES, NOT TWO, and collapsing the last two is a bug the prototype
                  actually shipped: deleting all nine venues showed the FILTER-MISS panel reading
                  "ไม่มีสถานที่ที่ตรงกับ  — ลองลดตัวกรองลง" — a sentence with a hole in it, pointing
                  at filters nobody had set, beside a button that clears nothing.
                    rows shown        → the grid
                    none, no filters  → "ยังไม่มีสถานที่ในระบบ" + the consequence + เพิ่ม
                    none, filtered    → the miss, naming which control produced it */}
              {shown.length > 0 ? (
                <ul className="venue-grid m-0 grid list-none gap-3 p-3 sm:gap-4 sm:p-4 lg:p-5">
                  {shown.map((v) => (
                    <VenueCard
                      key={v.id}
                      venue={v}
                      canWrite={acl.write}
                      onOpen={() => openRecord(v)}
                    />
                  ))}
                </ul>
              ) : anyFilter ? (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-base-200">
                    <Glyph d={ICON.search} className="h-8 w-8 text-base-content/60" />
                  </div>
                  <h2 className="th-tight text-[18px] font-semibold text-base-content">
                    ไม่พบสถานที่ที่ตรงกับที่กรองไว้
                  </h2>
                  <p className="th-tight mt-1.5 max-w-sm text-[14px] leading-[1.6] text-base-content/70">
                    ไม่มีสถานที่ที่ตรงกับ {describeFilters(term, typeFilter, statusFilter, {
                      types: assignableTypes,
                      fallback: fallbackType,
                    })}{' '}
                    — ลองลดตัวกรองลง
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <Btn variant="ghost" onClick={clearFilters}>
                      ล้างตัวกรองทั้งหมด
                    </Btn>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<Glyph d={ICON.building} className="h-8 w-8 text-base-content/60" />}
                  title="ยังไม่มีสถานที่ในระบบ"
                  // The CONSEQUENCE, like every other empty state here: with no venue there is
                  // nothing to book, so the LINE side of the product does not merely look bare — it
                  // has no function.
                  description="ผู้ใช้จะไม่เห็นสถานที่ให้เลือกใน LINE และจะส่งคำขอจองไม่ได้เลย จนกว่าจะเพิ่มอย่างน้อยหนึ่งแห่ง"
                  actions={
                    acl.write ? (
                      <Btn variant="primary" onClick={openCreate}>
                        <Glyph d={ICON.plus} />
                        เพิ่มสถานที่แห่งแรก
                      </Btn>
                    ) : undefined
                  }
                />
              )}
            </div>

            <div className="flex shrink-0 flex-col items-center justify-between gap-3 border-t border-base-300 p-4 sm:flex-row lg:px-5">
              <p className="text-[14px] text-base-content/70">
                ทั้งหมด{' '}
                <span className="font-medium tabular-nums text-base-content/90">{all.length}</span>{' '}
                แห่ง
                {shown.length !== all.length && (
                  <>
                    {' '}
                    · ตรงกับที่กรองไว้{' '}
                    <span className="font-medium tabular-nums text-base-content/90">
                      {shown.length}
                    </span>{' '}
                    แห่ง
                  </>
                )}
                {/* ⚠️ COUNTED OVER `shown`, NOT OVER EVERYTHING. It was global in the prototype,
                    sitting at the end of a bar whose other numbers describe the filtered set — so
                    filtering to หอประชุม (2 venues, none closed) still printed "…ตรงกับที่กรองไว้ 2
                    แห่ง · ปิดชั่วคราว 1 แห่ง", and every reader binds that 1 to the 2 beside it. A
                    number in this bar describes what is on screen, or it does not belong in it. */}
                {closedShown > 0 && (
                  <>
                    {' '}
                    · ปิดชั่วคราว{' '}
                    <span className="font-medium tabular-nums text-warning">{closedShown}</span> แห่ง
                  </>
                )}
              </p>
              <p className="text-[13px] text-base-content/70">เรียงตามชื่อ ก–ฮ</p>
            </div>
          </div>
        )}
      </div>

      <VenueFormDialog
        open={form !== null}
        mode={form?.mode ?? 'view'}
        target={target}
        types={assignableTypes}
        amenities={amenities ?? []}
        alert={formAlert ?? vocabAlert}
        fieldErrors={fieldErrors}
        busy={busy}
        onSubmit={(values) => void submit(values)}
        onClose={closeForm}
        onDelete={() => target && setPending({ kind: 'delete', venue: target })}
        onToggleOpen={() =>
          target && setPending({ kind: target.isOpen ? 'close' : 'reopen', venue: target })
        }
      />

      {/* ── Three kinds where the option tables needed one ──
          Not symmetry for its own sake: closing and deleting a venue have different consequences for
          BOOKINGS THAT ALREADY EXIST, which is the fact an operator is actually deciding about.

          ⚠️ BOTH STRINGS ARE CAREFUL ABOUT A MODULE THAT DOES NOT EXIST. There is no `Booking` model,
          so neither may promise what happens to approved requests — the close copy says only that no
          NEW ones can be made, and the delete copy names the request HISTORY rather than live
          bookings. Writing "การจองที่อนุมัติแล้วจะถูกยกเลิก" here would be designing the booking
          module from inside a confirm dialog. */}
      <ConfirmModal
        open={pending?.kind === 'close'}
        onClose={() => setPending(null)}
        onConfirm={runPending}
        title="ยืนยันการปิดชั่วคราว"
        who={pending?.venue.name}
        description="สถานที่นี้จะหายไปจากรายการที่ผู้ใช้เลือกได้ใน LINE และจะส่งคำขอจองใหม่ไม่ได้ จนกว่าจะเปิดอีกครั้ง"
        // `pause`, not `warn` — see `ConfirmTone`. `warn` is the SKY tone, named for its button, and
        // reaching for it here rendered ปิดชั่วคราว in the same blue as ส่งคืนเพื่อแก้ไข.
        tone="pause"
        confirmLabel="ปิดชั่วคราว"
        busyLabel="กำลังปิด"
        // The one place in this portal where a reason is BOTH stored and shown to the people it
        // affects. A block reason is internal and a return reason goes to one named person; this one
        // goes on the card and, once LIFF exists, in front of everybody who tries to book the room.
        // The hint has to say so, or it gets filled in like an internal note.
        reason={{
          label: 'เหตุผลที่ปิด',
          hint: 'แสดงบนการ์ดของสถานที่นี้ และผู้ใช้จะเห็นตอนเลือกสถานที่ · เช่น “ปิดปรับปรุงพื้นถึง 30 ก.ย.”',
          required: true,
        }}
      />

      <ConfirmModal
        open={pending?.kind === 'reopen'}
        onClose={() => setPending(null)}
        onConfirm={runPending}
        title="ยืนยันการเปิดให้จอง"
        who={pending?.venue.name}
        description="สถานที่นี้จะกลับไปอยู่ในรายการที่ผู้ใช้เลือกได้ทันที และเหตุผลที่ปิดไว้จะถูกล้างทิ้ง"
        tone="primary"
        confirmLabel="เปิดให้จอง"
        busyLabel="กำลังเปิด"
      />

      <ConfirmModal
        open={pending?.kind === 'delete'}
        onClose={() => setPending(null)}
        onConfirm={runPending}
        title="ยืนยันการลบสถานที่"
        who={pending?.venue.name}
        description={
          <>
            {/* Names the CATEGORY this venue is leaving, because that number is visible on the
                ประเภทสถานที่ card and is about to change — the two screens are one dataset and a
                delete here is felt there. */}
            {pending?.kind === 'delete' && (
              <>
                ประเภท “{pending.venue.venueType.name}” จะเหลือ {siblingsAfterDelete} แห่ง ·{' '}
              </>
            )}
            ประวัติคำขอจองของสถานที่นี้ยังอยู่ครบ · หากเป็นการปิดปรับปรุงหรือซ่อมแซม ให้ใช้
            “ปิดชั่วคราว” แทน แล้วเปิดคืนได้เมื่อพร้อม
          </>
        }
        tone="danger"
        confirmLabel="ลบสถานที่นี้"
        busyLabel="กำลังลบ"
      />
    </div>
  )
}

/**
 * "คำค้นหา “โรงยิม” · ประเภท “หอประชุม”" — says WHICH control produced the miss.
 *
 * Two of the three are selects the operator may have set minutes ago on another visit, so a bare
 * "ไม่พบอะไรเลย" leaves them hunting. Joined with `·` rather than `และ`: three filters produce
 * "…และ…และ…", which measured as a sentence nobody finishes reading.
 *
 * ⚠️ THE OPTION'S TEXT, NOT ITS VALUE. The value is an id, and printing `ประเภท "74"` would be the
 * rename bug wearing a new hat.
 */
function describeFilters(
  term: string,
  typeFilter: string,
  statusFilter: string,
  types: { types: { id: number; name: string }[]; fallback: { id: number; name: string } | null },
): string {
  const bits: string[] = []
  const t = term.trim()
  if (t) bits.push(`คำค้นหา “${t}”`)
  if (typeFilter) {
    const id = Number(typeFilter)
    const name =
      types.types.find((x) => x.id === id)?.name ??
      (types.fallback?.id === id ? types.fallback.name : '')
    bits.push(`ประเภท “${name}”`)
  }
  if (statusFilter) {
    bits.push(`สถานะ “${statusFilter === 'open' ? 'เปิดให้จอง' : 'ปิดชั่วคราว'}”`)
  }
  return bits.join(' · ')
}

/**
 * Six skeleton cards — two full rows at the widest grid, three at the narrowest.
 *
 * ⚠️ THE 16:9 BOX IS THE POINT. A skeleton made of text bars would collapse to a third of the height
 * and the page would grow 400px under the cursor the moment real data landed. Fewer than six would
 * leave the card visibly short of the real list and make the swap read as rows appearing rather than
 * placeholders being replaced.
 */
function LoadingPanel() {
  return (
    <SkeletonRegion label="กำลังโหลดรายการสถานที่" className="card-shell">
      <div className="card-scroll nav-scroll">
        <ul className="venue-grid m-0 grid list-none gap-3 p-3 sm:gap-4 sm:p-4 lg:p-5" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <VenueCardSkeleton key={i} />
          ))}
        </ul>
      </div>
      <div className="flex shrink-0 flex-col items-center justify-between gap-3 border-t border-base-300 p-4 sm:flex-row lg:px-5">
        <Skeleton variant="soft" className="h-3.5" width="9rem" />
        <Skeleton variant="soft" className="h-3.5" width="6rem" />
      </div>
    </SkeletonRegion>
  )
}

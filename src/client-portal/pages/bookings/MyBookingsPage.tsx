import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  SORTS,
  STATUS_LABEL,
  bookingState,
  isHistory,
  type Booking,
  type BookingSort,
  type StatusFilter,
} from './booking-state'
import { listMyBookings, messageFor } from './bookings-api'
import { BookingCard } from './components/BookingCard'
import { EmptyState } from '@/client-portal/components/feedback/EmptyState'
import { Skeleton } from '@/client-portal/components/feedback/Skeleton'
import { Dropdown } from '@/client-portal/components/ui/Dropdown'
import { SCREEN_WIDTH, ScreenHeader } from '@/client-portal/components/ui/ScreenHeader'
import { LIcon } from '@/client-portal/icons/LucideIcon'

/**
 * `#/bookings` — My Bookings. Prototype 1530–1605 and `paintBookings` (4864).
 *
 * ── 🟠 THERE ARE NO ACCORDION GROUPS HERE, AND THAT IS THE PORT, NOT AN OMISSION ──
 * `CHECKLIST.md`'s Phase 6 rows describe four `<details class="collapse">` buckets (pending /
 * approved / rejected open, history collapsed) and a row of category chips. **The prototype was
 * rewritten on 1 ก.ย. 2569 (`my_bookings_redesign_spec`) and has neither** — it is a flat, sorted
 * list with a status filter. Those checklist rows predate the rewrite, and the prototype is the
 * design authority (`PAGE_INDEX.md` §1.4, and it is the artefact the PO reviewed).
 *
 * The rewrite's own reasoning, written next to the hole each one left:
 *   · the four **status chips** became one dropdown on the search row (1568) — a chip row occupies
 *     two full-width lines permanently to convey "there are four categories", which is read once,
 *     and on a 375 px screen those two lines are the first card pushed off the bottom;
 *   · grouping and filtering by status are **the same job done twice**. With a status filter present,
 *     an accordion adds a second control for the same axis and a second place for the counts to
 *     disagree.
 * `#/venues` had its own chip row removed on the same day for the same reason, so a chip row here
 * would be the only one left in the portal.
 *
 * ── ⚠️ THE VENUE-TYPE FILTER IS A DROPDOWN, NOT CHIPS ──
 * The brief's requirement behind the chips is real and is honoured: *offer only the types the reader
 * actually has requests in, because a filter that yields zero is a dead end.* It is built in the
 * shape this portal already uses for exactly that (`#/venues`' type dropdown), rather than as the
 * one chip row in the app.
 *
 * ── 🔴 WHICH FILTER RUNS WHERE, AND WHY IT IS NOT ARBITRARY ──
 * `q` and `sort` go to the server, because the endpoint implements precisely them. **`status` and
 * the venue type run in the browser**: the status buckets are derived from the clock
 * (`booking-state.ts` — a past `APPROVED` is `สิ้นสุดแล้ว`, and `ประวัติ` is four states at once),
 * so `?status=APPROVED` would answer a different question than the one the dropdown asks. The type
 * is on every row already, so a round trip would buy nothing.
 */

/** How long after the last keystroke the search is sent. The list is server-side searched. */
const DEBOUNCE_MS = 300

export function MyBookingsPage() {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [status, setStatus] = useState<StatusFilter>('')
  const [type, setType] = useState<string | null>(null)
  const [sort, setSort] = useState<BookingSort>('created-desc')
  const [rows, setRows] = useState<Booking[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  /* ⚠️ THE DEBOUNCE IS ON THE VALUE SENT, NOT ON THE INPUT — the field stays fully controlled and
     echoes every keystroke immediately; only the request waits. Debouncing the input itself is how
     a text box starts dropping characters on a slow phone. */
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [query])

  useEffect(() => {
    let cancelled = false
    setFailure(null)
    void (async () => {
      try {
        const data = await listMyBookings({ q: debounced || undefined, sort })
        if (!cancelled) setRows(data)
      } catch (error) {
        console.warn('[bookings] list failed:', error)
        if (!cancelled) {
          setFailure(messageFor(error))
          setRows([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [debounced, sort, reload])

  /* 🔴 THE TYPE LIST COMES FROM THE BOOKINGS THAT EXIST, NOT FROM A WRITTEN-DOWN LIST — the same
     rule `#/venues` follows. An option that matches nothing is a dead end, and a hard-coded
     vocabulary drifts the moment an admin renames a category. */
  const types = useMemo(() => {
    const seen = new Set<string>()
    for (const b of rows ?? []) seen.add(b.venue.venueType.name)
    return [...seen].sort((a, b) => a.localeCompare(b, 'th'))
  }, [rows])

  const shown = useMemo(() => {
    return (rows ?? []).filter((b) => {
      if (type && b.venue.venueType.name !== type) return false
      if (!status) return true
      const state = bookingState(b)
      return status === 'history' ? isHistory(state) : state === status
    })
  }, [rows, status, type])

  const loading = rows === null
  const filtered = Boolean(debounced || status || type)

  const clearAll = () => {
    setQuery('')
    setStatus('')
    setType(null)
  }

  return (
    <section className="pad-nav min-h-dvh">
      {/* ⚠️ ONE TIER, NO BREADCRUMBS. This is a top-level dock tab — it is not a step after any
          other screen, so there is no way back to name (the same rule `#/home` and `#/venues`
          follow). The dock stays visible here; `NAV_SCREENS` lists `bookings`, and `LiffShell`
          reads that table rather than this file. */}
      <ScreenHeader
        title="การจองของฉัน"
        subtitle="ติดตามสถานะและประวัติการยื่นคำขอใช้สถานที่"
      />

      <div className={`${SCREEN_WIDTH} pt-4`}>
        {/* ─── Search + the two filters, one row ─────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <label className="input input-lg flex min-w-0 flex-1 items-center gap-2 border-base-300 bg-base-100 shadow-2xs">
            {/* The r=7 magnifier written inline, as all three search fields in this portal do —
                `licon.ts` deliberately carries no `search` key, because lucide's is r=8 with a
                longer handle and would silently reintroduce a mismatch between the three screens. */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
              className="h-4 w-4 opacity-60"
            >
              <circle cx="11" cy="11" r="7" />
              <path strokeLinecap="round" d="m20 20-3.5-3.5" />
            </svg>
            {/* ⚠️ THE PLACEHOLDER NAMES ALL THREE THINGS THE SEARCH ACTUALLY MATCHES. A box that
                catches more than it advertises is a box people stop trusting; `#BR-…` is spelled
                with the hash because that is how the card prints the code, and the server strips a
                leading `#` so both forms find the row. */}
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 grow"
              placeholder="ค้นหาสถานที่ วัตถุประสงค์ หรือ #BR-…"
              aria-label="ค้นหาคำขอของฉัน"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>

          {/* Only offered when there is more than one type to choose between — a filter with a
              single option is a control that cannot change anything. */}
          {types.length > 1 ? (
            <Dropdown
              align="end"
              label="กรองตามประเภทสถานที่"
              trigger={
                <>
                  <LIcon name="building2" className="h-5 w-5 shrink-0" />
                  <span className="sr-only">ประเภทสถานที่:</span>
                  <span className="sr-only text-sm font-medium sm:not-sr-only">
                    {type ?? 'ทุกประเภท'}
                  </span>
                  <LIcon
                    name="chevronDown"
                    className="hidden h-4 w-4 shrink-0 opacity-60 sm:block"
                  />
                </>
              }
            >
              <li>
                <button
                  type="button"
                  onClick={() => setType(null)}
                  aria-pressed={type === null}
                  className={type === null ? 'menu-active' : ''}
                >
                  ทุกประเภท
                </button>
              </li>
              {types.map((t) => (
                <li key={t}>
                  <button
                    type="button"
                    onClick={() => setType(t)}
                    aria-pressed={type === t}
                    className={type === t ? 'menu-active' : ''}
                  >
                    {t}
                  </button>
                </li>
              ))}
            </Dropdown>
          ) : null}

          {/* ⚠️ `<li><button>` per daisyUI's `menu`. Do NOT add `btn` to these — `menu-active`
              selects `li > *:not(.btn)`, so the selected state would go silently missing. */}
          <Dropdown
            align="end"
            label="กรองตามสถานะคำขอ"
            trigger={
              <>
                <LIcon name="slidersHorizontal" className="h-5 w-5 shrink-0" />
                <span className="sr-only">สถานะคำขอ:</span>
                <span className="sr-only text-sm font-medium sm:not-sr-only">
                  {STATUS_LABEL[status]}
                </span>
                <LIcon
                  name="chevronDown"
                  className="hidden h-4 w-4 shrink-0 opacity-60 sm:block"
                />
              </>
            }
          >
            {(Object.keys(STATUS_LABEL) as StatusFilter[]).map((key) => (
              <li key={key || 'all'}>
                <button
                  type="button"
                  onClick={() => setStatus(key)}
                  aria-pressed={status === key}
                  className={status === key ? 'menu-active' : ''}
                >
                  {STATUS_LABEL[key]}
                </button>
              </li>
            ))}
          </Dropdown>
        </div>

        {/* ─── Count + sort ──────────────────────────────────────────────────────────── */}
        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-base-content/70">
          <p className="min-w-0 font-medium">
            {loading ? '' : `แสดง ${shown.length} รายการ (${STATUS_LABEL[status]})`}
          </p>
          {/* ── 🔴 TWO LABELS PER OPTION, AND THEY ARE NOT THE SAME WORDS ABBREVIATED ──
              The menu has to say which DATE it sorts by and in which direction
              (`วันที่ยื่นคำขอ: ล่าสุด – เก่าสุด`); the button has to be short enough not to push
              the count onto a second line at 390 px (`ยื่นล่าสุด`). A `<select>` forces the two to
              be one string, and there is no string that is both.

              ⚠️ `h-11 min-h-11` — 44 px, where the prototype writes `h-8` (32). Its comment argues
              only against **48**, on the grounds that this is a secondary row and 48 would make it
              as tall as the search row; 44 does not do that, and `Q-C6` has already ruled once that
              a sort control specifically must reach 44 (it lists "the sort select 28 → 44" among
              the four targets it fixed). Both constraints hold at 44. */}
          <Dropdown
            align="end"
            label="เรียงลำดับรายการคำขอ"
            triggerClassName="btn btn-sm h-11 min-h-11 gap-1.5 border-base-300 bg-base-100 px-2.5 text-xs font-normal text-base-content shadow-2xs hover:bg-base-200/60"
            contentClassName="w-60 p-1.5 text-xs"
            trigger={
              <>
                <LIcon name="arrowUpDown" className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <span className="sr-only">เรียงลำดับ:</span>
                <span>{SORTS.find((s) => s.value === sort)?.short}</span>
                <LIcon name="chevronDown" className="h-3.5 w-3.5 shrink-0 opacity-60" />
              </>
            }
          >
            {SORTS.map((s) => (
              <li key={s.value}>
                <button
                  type="button"
                  onClick={() => setSort(s.value)}
                  aria-pressed={sort === s.value}
                  className={sort === s.value ? 'menu-active' : ''}
                >
                  {s.long}
                </button>
              </li>
            ))}
          </Dropdown>
        </div>

        {failure ? (
          <div role="alert" className="mt-3 rounded-box border border-error/40 bg-base-100 p-4">
            <p className="text-sm font-medium text-base-content">{failure}</p>
            <button
              type="button"
              onClick={() => {
                setRows(null)
                setReload((n) => n + 1)
              }}
              className="btn btn-app btn-outline mt-3"
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        ) : null}

        <div className="mt-3 space-y-3 pb-8">
          {loading
            ? /* ⚠️ THE SKELETON HAS THE CARD'S PROPORTIONS — a header strip, three body lines and
                 the grey capsule. A skeleton of a different height is a page that jumps when the
                 data lands, which is the one thing a skeleton exists to prevent.
                 ⚠️ It shows on ENTRY only, never while filtering: grey boxes flashing on every
                 keystroke make a fast screen feel slow. */
              Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="card overflow-hidden bg-base-100 shadow-sm">
                  <div className="border-b border-base-300/60 px-4 py-2.5">
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                  <div className="card-body gap-2 p-4">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                </div>
              ))
            : shown.map((b) => <BookingCard key={b.id} booking={b} />)}

          {/* 🔴 TWO EMPTY STATES, BECAUSE THEY NEED DIFFERENT ACTIONS. "Nothing matched" is a dead
              end the reader built themselves, and the screen offers the button that undoes it —
              leaving them to switch each filter off puts the work of undoing the cause on the
              person who cannot see it. "You have never booked anything" cannot be fixed by a reset,
              so it offers the thing that actually helps: go and book something. */}
          {!loading && !failure && shown.length === 0 ? (
            filtered ? (
              <EmptyState
                icon={<LIcon name="calendarCheck2" className="h-6 w-6" />}
                title="ไม่พบคำขอที่ตรงกับเงื่อนไข"
                description="ลองเปลี่ยนคำค้นหา หรือเลือกสถานะอื่น"
                action={
                  <button type="button" onClick={clearAll} className="btn btn-app btn-outline">
                    ล้างตัวกรองทั้งหมด
                  </button>
                }
              />
            ) : (
              <EmptyState
                icon={<LIcon name="calendarCheck2" className="h-6 w-6" />}
                title="ยังไม่มีคำขอใช้สถานที่"
                description="เมื่อคุณยื่นคำขอแล้ว รายการจะมาอยู่ที่นี่"
                action={
                  /* A router `<Link>`, never a bare `<a href>`: a full page load here restarts the
                     LIFF gate's four checks for a destination the user is already permitted to
                     reach. */
                  <Link to="/venues" className="btn btn-app btn-primary gap-2">
                    <LIcon name="plus" className="h-4 w-4 shrink-0" />
                    เริ่มต้นจองสถานที่
                  </Link>
                }
              />
            )
          ) : null}
        </div>
      </div>
    </section>
  )
}

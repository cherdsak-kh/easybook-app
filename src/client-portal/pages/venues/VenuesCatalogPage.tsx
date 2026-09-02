import { useEffect, useMemo, useState } from 'react'
import { VenueCard } from './components/VenueCard'
import { listVenues, messageFor } from './venues-api'
import { EmptyState } from '@/client-portal/components/feedback/EmptyState'
import { Skeleton } from '@/client-portal/components/feedback/Skeleton'
import { Dropdown } from '@/client-portal/components/ui/Dropdown'
import { LIcon } from '@/client-portal/icons/LucideIcon'
import type { Venue } from '@/lib/api-client'

/**
 * `#/venues` — the catalogue. Prototype 953–1057 and `paintVenues` (3375).
 *
 * ── 🟠 THE CHIPS, THE SORT SELECT AND THE CARD-SIZE TOGGLE ARE NOT HERE, AND THAT IS THE PORT ──
 * The brief and `CHECKLIST.md`'s Phase 4 line both list "category chips, sort dropdown, card-size
 * toggle". The prototype was **redesigned on 1 ก.ย. 2569** and removed all three, each with its
 * reason written next to the hole it left:
 *   · the six category chips became **this one dropdown** (975) — the chip row occupied two full
 *     lines permanently to convey "there are six categories", which is read once, while a single
 *     button that prints the current value says the same thing in one line;
 *   · the sort select went, and its disappearance **promoted the closed-venues-sink rule to the
 *     primary order** (3247) — bookable first, then ก–ฮ;
 *   · the card-size toggle went with the third and fourth grid columns (1040), because a card that
 *     is a photo plus three lines plus a badge row truncates every one of those lines at once when
 *     squeezed to ~240 px.
 * `DECISIONS.md` §3.6 is still honoured — its rule is *chips wrap, never scroll horizontally*, and
 * its subject is `#mb-filter` on `#/bookings`. A dropdown cannot scroll horizontally at all.
 *
 * ── 🔴 TWO COLUMNS AT `sm:`, AND NO THIRD STEP ──
 * `grid-cols-1 sm:grid-cols-2`, exactly. The first step must be `sm:` and not `md:`: a Honor Pad
 * X9A in portrait measures **≈670 CSS px**, below the `md` breakpoint of 768 despite being a
 * tablet, because LINE's webview reports CSS pixels by Android density. `sm:` (640) is the only
 * step that catches it, and no phone reaches 640 CSS px.
 */

/** How long after the last keystroke the search is sent. */
const DEBOUNCE_MS = 300

export function VenuesCatalogPage() {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [type, setType] = useState<string | null>(null)
  const [openOnly, setOpenOnly] = useState(false)
  const [venues, setVenues] = useState<Venue[] | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  /* ⚠️ THE DEBOUNCE IS ON THE VALUE SENT, NOT ON THE INPUT. The field stays fully controlled and
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
        const rows = await listVenues({ q: debounced || undefined })
        if (!cancelled) setVenues(rows)
      } catch (error) {
        console.warn('[venues] list failed:', error)
        if (!cancelled) {
          setFailure(messageFor(error))
          setVenues([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [debounced, reload])

  /* 🔴 THE TYPE LIST COMES FROM THE VENUES THAT EXIST, NOT FROM A WRITTEN-DOWN LIST. A filter
     option that matches nothing is a dead end, and a hard-coded vocabulary drifts the moment an
     admin renames a category. */
  const types = useMemo(() => {
    const seen = new Map<string, string>()
    for (const v of venues ?? []) seen.set(v.venueType.name, v.venueType.name)
    return [...seen.keys()].sort((a, b) => a.localeCompare(b, 'th'))
  }, [venues])

  /* Type and open-only narrow the list in the browser; the search text goes to the server. The
     split is not arbitrary — `q` is the one the endpoint implements, and the other two are
     derived from fields already on every row, so a round trip would buy nothing. */
  const shown = useMemo(() => {
    const rows = (venues ?? []).filter(
      (v) => (!type || v.venueType.name === type) && (!openOnly || v.isOpen),
    )
    /* 🔴 CLOSED VENUES SINK, AND NOTHING COMPETES WITH THAT ANY MORE. With the sort select gone
       this is the primary order: bookable first, then by name. A venue that cannot be tapped —
       and since the redesign it genuinely cannot — is not a result, so letting it head the list
       gives the top of the page to a dead end. */
    return rows.sort((a, b) =>
      a.isOpen !== b.isOpen ? (a.isOpen ? -1 : 1) : a.name.localeCompare(b.name, 'th'),
    )
  }, [venues, type, openOnly])

  const loading = venues === null
  const filtered = Boolean(debounced || type || openOnly)

  return (
    <section className="pad-nav min-h-dvh">
      <header className="hdr-blur sticky top-0 z-30 border-b border-base-300 bg-base-100/90 shadow-xs backdrop-blur-md">
        <div className="mx-auto w-full max-w-md px-4 pb-3 pt-safe sm:max-w-2xl md:max-w-4xl lg:max-w-5xl">
          <h1 className="text-xl font-semibold">จองสถานที่</h1>
          {/* ⚠️ The sub-line says what can be DONE here rather than restating the title — this
              screen and `#/home` both show a list of venues, and a reader arriving at either must
              be able to tell instantly which one leads to a booking. */}
          <p className="mt-0.5 text-xs text-base-content/60">
            ค้นหาและเลือกสถานที่ที่ต้องการขอใช้บริการ
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-md px-4 pt-4 sm:max-w-2xl md:max-w-4xl lg:max-w-5xl">
        {/* ─── Search + type filter, one row ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <label className="input input-lg flex min-w-0 flex-1 items-center gap-2 border-base-300 bg-base-100 shadow-2xs">
            {/* The r=7 magnifier written inline, as all three search fields in the prototype do —
                `licon.ts` deliberately carries no `search` key, because lucide's is r=8 with a
                longer handle and would silently reintroduce the mismatch it was removed over. */}
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
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="grow"
              placeholder="ค้นหาชื่อสถานที่หรืออาคาร"
              aria-label="ค้นหาชื่อสถานที่หรืออาคาร"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>

          {/* ⚠️ `h-12 min-h-12 w-12` = 48 px both ways on a phone. An icon-only button has no text
              width to make up the target area, so it has to carry the full size itself; the label
              appears as text only from `sm:` up. */}
          <Dropdown
            align="end"
            label="กรองตามประเภทสถานที่"
            triggerClassName="btn h-12 min-h-12 w-12 border-base-300 bg-base-100 px-0 font-normal shadow-2xs hover:bg-base-200/60 sm:w-auto sm:gap-2 sm:px-4"
            trigger={
              <>
                <LIcon name="slidersHorizontal" className="h-5 w-5 shrink-0" />
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
            contentClassName="mt-2 w-52 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
          >
            {/* ⚠️ `<li><button>` per daisyUI's `menu`. Do NOT add `btn` to these — its
                `menu-active` rule selects `li > *:not(.btn)`, so the selected state would go
                silently missing. */}
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
        </div>

        {/* ─── Count line + open-only switch ─────────────────────────────────────────── */}
        <div className="mt-3 flex items-center justify-between gap-2 px-1">
          {/* 🔴 "แสดง N สถานที่" with no "· ปิดชั่วคราว N" tail. The tail existed because a closed
              card used to look like the others but fainter; now it carries a dark scrim and a red
              badge across the photo, which says the same thing far more loudly. */}
          <p className="text-sm text-base-content/60">
            {loading ? '' : `แสดง ${shown.length} สถานที่`}
          </p>
          {/* ⚠️ `min-h-11`: the switch itself is 20 px tall, which passes no target guideline.
              THE PADDED LABEL IS THE TARGET, not the switch — an earlier attempt at `min-h-8`
              (32 px) still did not pass.
              ⚠️ A `toggle`, not a `checkbox`: a checkbox reads as "I am submitting this with a
              form", a toggle reads as "this is on right now", which is what a live filter is. */}
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs">
            <span className="text-base-content/70">เฉพาะที่เปิดให้จอง</span>
            <input
              type="checkbox"
              checked={openOnly}
              onChange={(e) => setOpenOnly(e.target.checked)}
              className="toggle toggle-sm toggle-success shrink-0"
            />
          </label>
        </div>

        {failure ? (
          <div role="alert" className="mt-3 rounded-box border border-error/40 bg-base-100 p-4">
            <p className="text-sm font-medium">{failure}</p>
            <button
              type="button"
              onClick={() => {
                setVenues(null)
                setReload((n) => n + 1)
              }}
              className="btn btn-app btn-outline mt-3"
            >
              ลองใหม่อีกครั้ง
            </button>
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {loading
            ? /* ⚠️ THE SKELETON MUST HAVE THE CARD'S PROPORTIONS — `aspect-video` plus a
                 `card-body p-4` of three lines. A skeleton of a different height is a page that
                 jumps when the data lands, which is the one thing a skeleton exists to prevent.
                 ⚠️ It shows on ENTRY only, never on filtering: flashing grey boxes on every
                 keystroke makes a fast screen feel slow. */
              Array.from({ length: 4 }, (_, i) => (
                <div
                  key={i}
                  className="card overflow-hidden border border-base-300 bg-base-100 shadow-sm"
                >
                  <Skeleton className="aspect-video w-full rounded-none" />
                  <div className="card-body gap-1.5 p-4">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                </div>
              ))
            : shown.map((v) => <VenueCard key={v.id} venue={v} />)}
        </div>

        {/* 🔴 TWO DIFFERENT EMPTY STATES, BECAUSE THEY NEED DIFFERENT ACTIONS. "Nothing matched
            your filters" is fixed by clearing them, and the screen offers the button that does it
            — leaving the reader to switch each filter off themselves puts the work of undoing the
            cause on the person who cannot see it. "No venues exist at all" cannot be fixed by the
            reader, so offering a reset there would be a button that changes nothing. */}
        {!loading && !failure && shown.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={<LIcon name="building2" className="h-6 w-6" />}
              title="ไม่พบสถานที่ที่ตรงกับเงื่อนไข"
              description="ลองเปลี่ยนคำค้นหา หรือเลือกประเภทสถานที่อื่น"
              action={
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setType(null)
                    setOpenOnly(false)
                  }}
                  className="btn btn-app btn-ghost btn-sm mt-2"
                >
                  ล้างตัวกรองทั้งหมด
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={<LIcon name="building2" className="h-6 w-6" />}
              title="ยังไม่มีสถานที่ให้จอง"
              description="เจ้าหน้าที่ยังไม่ได้เพิ่มสถานที่เข้าสู่ระบบ กรุณาติดต่อเจ้าหน้าที่"
            />
          )
        ) : null}
      </div>
    </section>
  )
}

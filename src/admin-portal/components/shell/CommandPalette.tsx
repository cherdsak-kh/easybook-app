/**
 * The command palette: a quick-jump PAGE NAVIGATOR over the route table, opened from the topbar's
 * `#cmd-trigger`, Ctrl/Cmd+K, or `/`. Ported from the prototype's `#cmd-palette` + "Command
 * palette" controller, which is the design authority.
 *
 * ⚠️ It is NOT a record search. It lists the destinations this role may open and navigates to the
 * one picked; it never reads bookings, people or venues. The ranking and grouping live in
 * `lib/command-palette-model.ts` (pure, unit-tested) — this file is the DOM half.
 *
 * ⚠️ A FIXED `div`, NOT A `<dialog>`, and it must not be "upgraded" to one:
 *  · React 19 + daisyUI: a `<form method="dialog">` backdrop never closes the dialog;
 *  · a native `<dialog>` closed from outside React jams;
 *  · there is no page scroll to lock (`<main>` scrolls), and the toast stack must stay reachable.
 * What `showModal()` would have supplied — Escape, a Tab trap, focus return — is written out below.
 * `useEscapeTopDialog` only looks at `dialog[open]`, so it never sees this as a dialog, which is
 * correct.
 *
 * ⚠️ THE ESCAPE / TAB LISTENER IS MOUNTED ONLY WHILE OPEN. The component renders nothing when
 * closed, so `PaletteBody`'s effects do not exist then: a capture-phase listener that always ran
 * would swallow Escape for every popup menu in the topbar.
 */

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NavIcon } from './nav-icons'
import {
  collectPalette,
  highlightParts,
  tokenize,
  type PaletteItem,
} from '../../lib/command-palette-model'
import type { Acl } from '../../lib/use-acl'
import { ADMIN_PORTAL_ROUTES, urlOf, type AdminRouteEntry } from '../../routes'

/**
 * The bell's "view all" row is labelled `ดูการแจ้งเตือนทั้งหมด`, which `nav-icons.tsx` has no glyph
 * for; the prototype gives it the bell's. Every other label is its own icon key.
 */
const ICON_KEY: Readonly<Record<string, string>> = {
  ดูการแจ้งเตือนทั้งหมด: 'การแจ้งเตือน',
}

/**
 * After a palette navigation, put focus on the new page's `<h1>` — the prototype's `__go` does,
 * and the app otherwise moves focus nowhere on a route change, so a keyboard user would be left on
 * a control in the topbar with the new page unannounced.
 *
 * Retries on animation frames for about a second, because the page may be a lazy chunk showing a
 * skeleton first. It waits for an `<h1>` that is not the one we left (otherwise it would focus the
 * OLD page's heading a frame before it is replaced), but gives up waiting after 250 ms for the case
 * where two routes share one component and React reuses the same node. No `<h1>` by the deadline =
 * do nothing; it never falls back to the trigger, which would undo the navigation.
 *
 * Scoped to the palette. Sidebar clicks do not get this.
 */
function focusHeadingAfterNavigation(previous: Element | null, sameRoute: boolean) {
  const start = performance.now()
  const tick = () => {
    const h1 = document.querySelector<HTMLElement>('main h1')
    const waited = performance.now() - start
    if (h1 && (sameRoute || h1 !== previous || waited > 250)) {
      h1.focus()
      return
    }
    if (waited < 1000) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

export function CommandPalette({
  open,
  onClose,
  acl,
}: {
  open: boolean
  /** `restoreFocus` is true for Escape / backdrop / the close button, false after a choice. */
  onClose: (restoreFocus: boolean) => void
  acl: Acl
}) {
  // Mounted fresh on every open, so the query, the active row and the focus all start clean.
  if (!open) return null
  return <PaletteBody onClose={onClose} acl={acl} />
}

function PaletteBody({
  onClose,
  acl,
}: {
  onClose: (restoreFocus: boolean) => void
  acl: Acl
}) {
  const navigate = useNavigate()
  const titleId = useId()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const downOnBackdrop = useRef(false)

  const tokens = useMemo(() => tokenize(query), [query])

  // Re-read on every render's ACL: a role switch while the palette is open re-filters it.
  const { sections, starts, flat } = useMemo(() => {
    const sections = collectPalette(ADMIN_PORTAL_ROUTES, acl.can, tokens)
    const starts: number[] = []
    const flat: PaletteItem<AdminRouteEntry>[] = []
    for (const s of sections) {
      starts.push(flat.length)
      flat.push(...s.items)
    }
    return { sections, starts, flat }
  }, [acl, tokens])

  const any = flat.length > 0
  const activeIdx = any ? Math.min(active, flat.length - 1) : 0

  // Fade in: commit opacity 0, force a style flush so the transition has a start, then release.
  // Done on the element directly (not state) so a throttled `requestAnimationFrame` can never
  // leave the palette stuck invisible. The class is not in `className`, so React never resets it.
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    el.classList.add('opacity-0')
    void el.offsetWidth
    el.classList.remove('opacity-0')
    inputRef.current?.focus()
  }, [])

  // A new query always starts at the top, with the first section's heading showing.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0
  }, [query])

  // Escape and the Tab trap on the DOCUMENT, in the capture phase. On the palette alone they would
  // miss the moment focus falls to <body> (a click on the box's own padding does that), leaving a
  // modal that Escape cannot close. `stopPropagation` also keeps the popup-menu and dialog Escape
  // handlers from acting on a key that belongs to the palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose(true)
        return
      }
      if (e.key !== 'Tab') return
      // Only what is on screen: the close button is `sm:hidden`, so at 1280 Tab stays on the input.
      const candidates: (HTMLElement | null)[] = [inputRef.current, closeRef.current]
      const focusable = candidates.filter(
        (n): n is HTMLElement => !!n && n.getClientRects().length > 0,
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const cur = document.activeElement
      if (!rootRef.current?.contains(cur)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && cur === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && cur === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const move = (to: number) => {
    if (!any) return
    const n = (to + flat.length) % flat.length // wraps both ways
    setActive(n)
    // The first row brings its section heading with it; the others only need to be in view.
    if (n === 0) {
      if (listRef.current) listRef.current.scrollTop = 0
    } else {
      document.getElementById(`cmd-opt-${n}`)?.scrollIntoView({ block: 'nearest' })
    }
  }

  const choose = (route: AdminRouteEntry) => {
    const to = urlOf(route)
    const previous = document.querySelector('main h1')
    const sameRoute = window.location.pathname === to
    // Focus is NOT restored to the trigger: it goes to the new page's heading instead.
    onClose(false)
    void navigate(to)
    focusHeadingAfterNavigation(previous, sameRoute)
  }

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Thai IME: Enter confirms the composition and must neither navigate nor close.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      move(activeIdx + 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      move(activeIdx - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = flat[activeIdx]
      if (item) choose(item.route)
    }
  }

  return (
    <div
      ref={rootRef}
      id="cmd-palette"
      className="fixed inset-0 z-50 flex items-start justify-center bg-[rgb(2_6_23_/_0.5)] p-3 pt-14 backdrop-blur-xs transition-opacity motion-reduce:transition-none sm:pt-20"
      // A click that STARTS inside the box and ends on the scrim (dragging a text selection out of
      // the input) is not a dismissal: both halves must land on the scrim itself.
      onMouseDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnBackdrop.current) onClose(true)
        downOnBackdrop.current = false
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[80dvh] w-full max-w-xl flex-col overflow-hidden rounded-card border border-base-300 bg-base-100 shadow-e2"
        // Clicking the box's own padding, the header icon or a row must not steal focus from the
        // input; only the input and the close button take it.
        onMouseDown={(e) => {
          if (!(e.target as HTMLElement).closest('input, button')) e.preventDefault()
        }}
      >
        <h2 id={titleId} className="sr-only">
          ค้นหาหน้าเมนูและคำสั่ง
        </h2>

        <div className="flex shrink-0 items-center border-b border-base-300 pl-4 pr-2 sm:pr-4">
          <svg
            aria-hidden="true"
            className="h-5 w-5 shrink-0 text-base-content/60"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {/* `outline-none` as a plain utility class, NEVER applied from CSS with `@apply`: in Tailwind v4
              that routes outline-style through a variable and silently blanks any later ring. The
              box's own border is the focus affordance here, as in the prototype. */}
          <input
            ref={inputRef}
            id="cmd-input"
            type="text"
            role="combobox"
            aria-label="ค้นหาหน้าเมนู"
            aria-expanded={any}
            aria-controls="cmd-results"
            aria-autocomplete="list"
            aria-activedescendant={any ? `cmd-opt-${activeIdx}` : undefined}
            placeholder="ค้นหาหน้าเมนูหรือคำสั่ง..."
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="go"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={onInputKeyDown}
            className="h-12 w-full min-w-0 bg-transparent px-3 text-[15px] outline-none placeholder:text-base-content/50"
          />
          <kbd
            aria-hidden="true"
            className="kbd kbd-sm hidden shrink-0 border-base-300 bg-base-100 font-mono text-[11px] text-base-content/70 sm:inline-flex"
          >
            ESC
          </kbd>
          {/* Touch has no Escape key. Hidden from sm up, where the kbd above says how. */}
          <button
            ref={closeRef}
            type="button"
            id="cmd-close"
            aria-label="ปิดหน้าต่างค้นหา"
            onClick={() => onClose(true)}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-control text-base-content/70 transition-colors hover:bg-base-content/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:hidden"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div
          ref={listRef}
          id="cmd-results"
          role="listbox"
          aria-label="เมนูที่พบ"
          hidden={!any}
          className="nav-scroll min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2"
        >
          {sections.map((section, si) => (
            <div key={section.name} role="group" aria-labelledby={`cmd-g-${si}`} className="flex flex-col gap-0.5">
              <p
                id={`cmd-g-${si}`}
                className="m-0 px-3 pb-1 pt-2 text-[12px] font-semibold text-base-content/60"
              >
                {section.name}
              </p>
              {section.items.map(({ route }, k) => {
                const n = starts[si] + k
                const on = n === activeIdx
                return (
                  <div
                    key={route.path}
                    id={`cmd-opt-${n}`}
                    role="option"
                    aria-selected={on}
                    onMouseMove={() => {
                      if (n !== activeIdx) setActive(n)
                    }}
                    onClick={() => choose(route)}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 py-2 ${
                      on ? 'bg-primary/10 font-medium text-primary' : 'text-base-content/90'
                    }`}
                  >
                    <span className={`shrink-0 ${on ? 'text-primary' : 'text-base-content/70'}`}>
                      <NavIcon label={ICON_KEY[route.label] ?? route.label} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] leading-[1.45]">
                        {highlightParts(route.label, tokens).map((p, i) =>
                          p.hit ? (
                            <mark key={i} className="rounded-[4px] bg-primary/20 px-0.5 text-inherit">
                              {p.text}
                            </mark>
                          ) : (
                            p.text
                          ),
                        )}
                      </span>
                      <span className="block truncate text-xs text-base-content/60">{route.desc}</span>
                    </span>
                    {/* The breadcrumb parent, but only where the section heading above does not
                        already say it — repeating "การบริหารจัดการ" on every row is noise. In
                        practice this labels the one page whose parent (การแจ้งเตือน) is not a
                        heading; ภาพรวมระบบ has no parent. */}
                    {route.group && route.group !== section.name && (
                      <span className="hidden shrink-0 text-xs text-base-content/60 sm:block">
                        {route.group}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        {!any && (
          <p className="m-0 px-4 py-10 text-center text-[14px] text-base-content/70">ไม่พบเมนูที่ค้นหา</p>
        )}
        <p role="status" className="sr-only">
          {any ? `พบ ${flat.length} เมนู` : 'ไม่พบเมนูที่ค้นหา'}
        </p>

        {/* Keyboard hints are noise on a phone, so this bar is sm and up only. */}
        <div className="hidden shrink-0 items-center gap-4 border-t border-base-300 bg-base-200/60 px-4 py-2.5 text-xs text-base-content/70 sm:flex">
          <span className="inline-flex items-center gap-1.5">
            <kbd className="kbd kbd-sm border-base-300 bg-base-100 text-[11px]">↑↓</kbd>
            เลื่อนรายการ
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="kbd kbd-sm border-base-300 bg-base-100 text-[11px]">↵</kbd>
            ไปที่หน้านี้
          </span>
          <span className="inline-flex items-center gap-1.5">
            <kbd className="kbd kbd-sm border-base-300 bg-base-100 text-[11px]">ESC</kbd>
            ปิด
          </span>
        </div>
      </div>
    </div>
  )
}

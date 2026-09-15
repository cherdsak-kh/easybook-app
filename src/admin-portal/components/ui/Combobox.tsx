/**
 * The admin portal's single-select — searchable for a list that has outgrown the native popup, and
 * with `searchable={false}` for a short one.
 *
 * ตำแหน่ง and กลุ่ม/ฝ่าย were the two fields that needed it first: they are school-maintained lists
 * that grow, and a native <select> answers "which one is มัธยมศึกษาตอนปลาย?" with a scroll-and-hunt.
 *
 * ⚠️ SINCE SLICE 9 (#ISSUE-09) THE SHORT LISTS USE IT TOO. The admin toolbars' role, status, access
 * and sort filters (StaffPage, LineUsersPage, VenuesPage, beside BookingRequestsPage's) are this
 * component with `searchable={false}` — a closed vocabulary that fits on screen is still worse off
 * behind a search box, so it drops the box and keeps the control. What that buys is ONE select across
 * the admin portal: the same 44px geometry, radius, border and theme scope everywhere, rather than
 * the operating system showing through wherever a list happened to be short. Do not "restore" a
 * native <select> for a short list; pass `searchable={false}`.
 *
 * ⚠️ IT LIVES IN `admin-portal/components/ui/`, NOT IN `components/shared/`. The folder rule
 * (`NotFound.tsx` states it from the other side) is about CONSUMERS, not about how reusable a
 * thing looks: `shared/` is for components with two portals reading them, and the client portal
 * has its own `Combobox` (`client-portal/components/ui/Combobox.tsx`). It sits beside
 * `FormField.tsx` because it composes that file's `Field` — see below.
 *
 * ── It composes `Field`, it does not re-line its markup ──
 * `Field` is the exported half of FormField.tsx that exists for exactly this case: "a field with
 * an unusual control". It owns the label/for wiring, the always-rendered error <p> (an assistive
 * technology only announces a live region that existed BEFORE the text arrived), `form-shell-err`
 * on the shell, and the hint's measured 573.4px spacing. A second copy of that markup would drift
 * from the first the day either is touched, and the drift would be invisible until somebody
 * measured the two fields side by side.
 *
 * The one thing this file adds to the shell is `px-0` (see `SHELL_*`): the trigger is the field
 * surface here, so its hover wash and its 44px hit target have to reach the border. It does NOT
 * add an error outline — `Field` already puts one on the shell, and a second would double it.
 *
 * ── The <dialog> trap ──
 * The call sites are of two kinds: forms inside `Modal` (StaffFormDialog, RegistrationEditDialog,
 * VenueFormDialog, BookingDirectCreateDialog) and page toolbars (see the `[data-theme]` note below).
 * `Modal` is a native <dialog> opened with `showModal()`, and for the first kind that makes an
 * in-flow dropdown impossible twice over: the form body is `overflow-y-auto` and
 * `admin-portal.css` additionally gives such a dialog `overflow: clip`, so the popper is clipped
 * by two ancestors — and no z-index reaches past either, because showModal() puts the dialog in
 * the TOP LAYER. So the popper is a `popover="manual"` element, which joins that same top layer.
 *
 * ⚠️ IT IS PORTALED INTO THE <dialog>, NOT INTO <body>, and that is not a detail. showModal()
 * marks everything OUTSIDE the dialog's subtree inert, and an inert search box cannot be typed
 * into. Top layer for painting, dialog subtree for interaction.
 *
 * ⚠️ AND WITH NO <dialog> ABOVE IT, IT PORTALS TO THE NEAREST `[data-theme]` — STILL NOT <body>.
 * `#rq-venue-f` and `#rq-sort` on คำขอจองสถานที่ sit in a page toolbar, so `closest('dialog')` is
 * null for them. `BackendLayout` stamps `data-theme` on a wrapper <div> rather than on <html>, on
 * purpose and for a good reason of its own — which leaves <body> OUTSIDE the themed subtree. A
 * popper portalled there resolves its tokens against `:root`, and `@plugin "daisyui" { themes: light
 * --default, dark --prefersdark }` makes `:root` DARK the moment the operating system is. The
 * operator then reads a light portal with one black dropdown in it, while every rule in
 * `admin-portal.css` is doing exactly what it says. The theme wrapper keeps the popper in the
 * same token scope as the trigger it belongs to (the client portal's Combobox portals this way
 * for the same reason).
 *
 * ⚠️ THE ORDER IS `dialog` FIRST, THEN `[data-theme]`, and it does not commute. A modal caller
 * gives up nothing by taking the dialog — the dialogs are themselves inside the theme wrapper, so
 * the tokens come along — whereas a `[data-theme]`-first host would put the search box back
 * outside the inert boundary, which is a control that cannot be typed into rather than a control
 * of the wrong colour.
 *
 * ⚠️ `manual`, NOT `auto`. An auto popover light-dismisses on any outside pointerdown — including
 * the one on the trigger, which would close it a tick before the trigger's own click reopened it.
 * The outside-click close is done here instead, on `pointerdown` in the CAPTURE phase, so it runs
 * before the browser moves focus to whatever was pressed.
 *
 * ⚠️ ESCAPE TAKES BOTH `preventDefault()` AND `stopPropagation()`. A `manual` popover is invisible
 * to the platform's close-request handling, so an un-prevented Escape goes straight to the
 * <dialog> — and the operator loses the whole half-typed form on their first attempt to dismiss a
 * dropdown.
 *
 * ── `searchable={false}` — the same control WITHOUT the filter box ──
 * Added for คำขอจองสถานที่'s เรียงลำดับ field, and it is a real distinction rather than a
 * preference: a search box over FOUR fixed sort options is a control that can only ever return you
 * to where you started, and it puts a text cursor in front of a list nobody needs to narrow. What
 * that screen needed was the LOOK — the same 44px trigger, border, chevron, popover, tick and hover
 * as the venue field beside it — because a native <select> next to a `.cbx-trigger` is the one place
 * in that toolbar the operating system shows through.
 *
 * ⚠️ IT IS A FLAG, NOT A SECOND COMPONENT (the prototype's `data-cbx-nosearch`, same decision).
 * Everything below is shared; the search row simply is not rendered, and the LIST takes the focus
 * and the `aria-activedescendant` the input would have held. That hand-off is the whole trick —
 * miss it and the popper opens with focus still on the trigger, OUTSIDE the popper, where the
 * keydown handler never fires and the arrow keys do nothing.
 *
 * ── `onCreateOption` — creatable mode (#ISSUE-11) ──
 * A caller that can write the vocabulary passes `onCreateOption`, and a typed name that matches no
 * option (case-insensitively, trimmed) grows ONE extra row at the bottom of the list:
 * `+ เพิ่ม “…”`. It is a real `role="option"` inside the listbox, so the arrow keys, Home/End and
 * `aria-activedescendant` reach it exactly as they reach the rows above — and Enter on an empty
 * filter lands on it, because it is then the only row there is.
 *
 * ⚠️ THE CALLER OWNS THE WRITE, THE LIST AND THE ERROR MESSAGE. This component only awaits the
 * promise: resolved, it selects the returned id, clears the query and closes; rejected, it stays OPEN
 * with the typed name intact, because the fix for "ชื่อนี้มีอยู่แล้ว" is to edit that name. The
 * caller must have inserted the new row into `options` before resolving, or the trigger shows the
 * placeholder over a value it has no row for.
 *
 * ⚠️ ONE WRITE AT A TIME. A ref guards the row, not only the state: a double-click lands both
 * events before React has re-rendered the disabled state, and two POSTs of one name is a 409 on the
 * second — an error toast for a write that succeeded.
 *
 * ⚠️ NEVER WITH `searchable={false}`. There is no query to create from, so the prop is ignored.
 *
 * `onOpen` is called every time the popper opens, so a caller can revalidate the list at the moment
 * somebody is about to read it — see `lib/master-sync.ts`.
 */

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { Spinner } from '../feedback/Spinner'
import { Field } from './FormField'

/**
 * Generic over the id so a caller passing numeric ids gets a NUMBER back from `onChange`.
 * Widening both sides to `number | string` and casting at the call site was the alternative, and
 * it moves a compiler guarantee into two hand-written `Number(...)`s that nothing checks.
 */
export interface ComboboxOption<T extends number | string = number | string> {
  id: T
  name: string
  /**
   * `isSystemReserved` — pulled out of the ordinary choices and listed under `สงวนของระบบ` at the
   * END of the list. Never sorted into the middle: the source list is sorted by name, so a
   * reserved ตำแหน่ง lands directly under an ordinary "ผู้ดูแลระบบ" and drops a heading nobody was
   * looking for between two ordinary rows.
   */
  reserved?: boolean
  /**
   * A tombstone — `ไม่พบตำแหน่ง` / `ไม่พบกลุ่ม/ฝ่าย`, or an option that was soft-deleted out of the
   * list. Rendered ONLY while it is already the value, and hidden outright otherwise: filing
   * somebody under "not found" on purpose is not something a form may offer. It is still rendered
   * when it IS the value, because omitting it would leave the control showing a name it cannot
   * account for, and a save would silently refile the person.
   */
  fallback?: boolean
}

const RESERVED_GROUP = 'สงวนของระบบ'
const NO_MATCH = 'ไม่พบตัวเลือกที่ตรงกับคำค้นหา'
const SEARCH_PLACEHOLDER = 'ค้นหา…'

/** trigger → popper, popper → viewport edge, and the floor a squeezed list may not go under. */
const GAP = 6
const EDGE = 8
const MIN_LIST = 88

/**
 * `Field` always renders `.form-shell` (`px-3.5`) around its control. The trigger takes that
 * padding over so its hover wash and its focus ring reach the field's edges — a fill that stops
 * 14px short of the border reads as a rendering fault rather than as a state.
 */
const SHELL_BASE = '[&>.form-shell]:px-0'
/**
 * The open-state lift, which `.form-shell:focus-within` CANNOT provide: while the popper is open
 * the focus is in the search box, and that box lives in the top layer as a child of the <dialog>,
 * not inside this shell. Driven off React's own `open` rather than a `:has()` selector, because
 * the component already knows the answer.
 */
const SHELL_OPEN = '[&>.form-shell]:border-primary/40 [&>.form-shell]:bg-base-100'

export function Combobox<T extends number | string>({
  options,
  value,
  onChange,
  label,
  placeholder = 'เลือก…',
  error,
  hint,
  disabled = false,
  required = false,
  searchable = true,
  icon,
  className = '',
  id,
  onCreateOption,
  onOpen,
}: {
  options: readonly ComboboxOption<T>[]
  /** The selected id. A value that matches nothing shows the placeholder. */
  value: T
  onChange: (id: T) => void
  label: ReactNode
  placeholder?: string
  error?: string
  /**
   * The standing advice under the field — `Field` renders it AFTER the error, at the measured
   * spacing, so an invalid field is corrected first and read second.
   *
   * ⚠️ IT IS A PASS-THROUGH, NOT A NEW IDEA. `Field` has always owned this slot; the prop was simply
   * never forwarded, so the venue picker in `#rq-create-modal` would otherwise have had to hand-roll
   * a `<p>` and pick its own margin — which is the drift `Field` exists to prevent.
   */
  hint?: ReactNode
  disabled?: boolean
  required?: boolean
  /**
   * `false` drops the filter box and hands the keyboard to the listbox instead. For a CLOSED,
   * SHORT vocabulary that cannot usefully be narrowed — see the header. Everything else about the
   * control is identical, which is the point.
   */
  searchable?: boolean
  /**
   * A glyph before the caption, inside the trigger.
   *
   * ⚠️ It exists because a value long enough to TRUNCATE cannot identify itself:
   * "วันที่ยื่นคำขอ (ใหม่…" with the tail cut off is indistinguishable from its own opposite. The
   * icon says which AXIS at a glance; the text says which end of it. Decorative — pass an
   * `aria-hidden` node, because the accessible name is the label plus the caption.
   */
  icon?: ReactNode
  className?: string
  id?: string
  /**
   * Creatable mode — see the header. Resolve with the new option (already in `options`), or reject
   * after telling the operator why; a rejection keeps the popper open with the name still typed.
   */
  onCreateOption?: (name: string) => Promise<ComboboxOption<T>>
  /** Called whenever the popper opens. For revalidating the list — see the header. */
  onOpen?: () => void
}) {
  const auto = useId()
  const fieldId = id ?? auto
  const labelId = `${fieldId}-label`
  const errorId = `${fieldId}-err`
  const listId = `${fieldId}-list`
  const optionId = (i: number) => `${fieldId}-opt-${i}`

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  /** Where the KEYBOARD is. Distinct from `value`, which is what the record holds. */
  const [active, setActive] = useState(0)
  /**
   * Where the popper is portalled, resolved once from the mounted trigger: the <dialog> for a
   * modal caller, otherwise the nearest `[data-theme]` so the tokens follow the trigger — see the
   * top of the file. `document.body` is the last resort, and reachable only from outside the
   * portal shell entirely.
   */
  const [host, setHost] = useState<HTMLElement | null>(null)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  /** An inline create is in flight. State for the rendering, a ref for the double-submit guard. */
  const [creating, setCreating] = useState(false)
  const creatingRef = useRef(false)
  /** The promise can outlive the component (the dialog closed mid-write). */
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    const el = triggerRef.current
    if (el) setHost(el.closest('dialog') ?? el.closest('[data-theme]') ?? document.body)
  }, [])

  const selected = options.find((o) => o.id === value)

  /**
   * ⚠️ THE TWO FLAGS ARE READ TOGETHER, and that is the bug the PO reported on 18 ส.ค. 2569.
   * `fallback` decides whether a row EXISTS for this render at all; `reserved` decides only which
   * of the two blocks it lands in. Reading `reserved` first — "hide the tombstone inside the
   * reserved group" — means an option carrying `fallback` without `reserved` comes back as an
   * ordinary, always-selectable choice.
   *
   * The heading is never searched: matching "สงวน" would return rows whose own text says nothing
   * of the sort. It is emitted only when a row of its own survived the filter, so an empty group
   * cannot exist.
   */
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const plain: ComboboxOption<T>[] = []
    const reserved: ComboboxOption<T>[] = []
    for (const o of options) {
      if (o.fallback && o.id !== value) continue
      if (needle && !o.name.toLowerCase().includes(needle)) continue
      if (o.reserved) reserved.push(o)
      else plain.push(o)
    }
    return { plain, reserved, flat: [...plain, ...reserved] }
  }, [options, value, query])

  /**
   * The name a create would send, and whether the row offering it exists.
   *
   * ⚠️ THE MATCH IS CHECKED AGAINST EVERY OPTION, NOT AGAINST THE FILTERED ROWS — and including the
   * hidden tombstone. "ครู" typed over a list holding "ครูผู้ช่วย" filters to one row that is NOT
   * "ครู", and creating it is correct; "ครู" typed over a list holding "ครู" must never offer a
   * second one, whichever group or visibility the first sits in. The server would 409 it anyway,
   * and an error toast for a row the operator could have just picked is the worst answer.
   */
  const createName = query.trim()
  const canCreate =
    searchable &&
    onCreateOption !== undefined &&
    createName !== '' &&
    !options.some((o) => o.name.trim().toLowerCase() === createName.toLowerCase())
  /** The create row sits after every real row, so its keyboard index is the row count. */
  const createIndex = rows.flat.length
  const navCount = rows.flat.length + (canCreate ? 1 : 0)
  const createId = `${fieldId}-create`

  /**
   * Where `active` goes when the list under it changes — adjusted DURING RENDER against the snapshot
   * it was last placed on, so no frame (and no Enter) ever pairs an old index with new rows.
   *
   * · Opening, typing, or a new `value`: onto the current value when the list shows it, else the top
   *   — so ArrowDown steps from where the record already is instead of from the top of a filtered list.
   * · ⚠️ THE OPTIONS ALONE CHANGING IS NOT A RESET (P6-1). `onOpen`, a focus and a broadcast all
   *   hand `options` a new array while the popper is open, often mid-keystroke. Resetting there moved
   *   the highlight off `เพิ่ม “ครู”` onto `ครูผู้ช่วย`, and Enter picked the wrong row. So the create
   *   row stays the create row while it is still offered; once the refreshed list holds that exact
   *   name, the highlight lands on it. A real row is followed by id, and clamped only if it is gone.
   */
  const [basis, setBasis] = useState({ open, query, value, flat: rows.flat, canCreate })
  if (
    basis.open !== open ||
    basis.query !== query ||
    basis.value !== value ||
    basis.flat !== rows.flat ||
    basis.canCreate !== canCreate
  ) {
    setBasis({ open, query, value, flat: rows.flat, canCreate })
    if (open) {
      const clamp = (i: number) => (navCount ? Math.min(Math.max(i, 0), navCount - 1) : 0)
      let next: number
      if (!basis.open || basis.query !== query || basis.value !== value) {
        const i = rows.flat.findIndex((o) => o.id === value)
        next = i > -1 ? i : 0
      } else if (basis.canCreate && active === basis.flat.length) {
        const needle = createName.toLowerCase()
        const i = canCreate
          ? createIndex
          : rows.flat.findIndex((o) => o.name.trim().toLowerCase() === needle)
        next = i > -1 ? i : clamp(active)
      } else {
        const held = basis.flat[active]
        const i = held ? rows.flat.findIndex((o) => o.id === held.id) : -1
        next = i > -1 ? i : clamp(active)
      }
      if (next !== active) setActive(next)
    }
  }

  const activeId =
    active < rows.flat.length ? optionId(active) : canCreate && active === createIndex ? createId : undefined

  const close = useCallback((refocus: boolean) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }, [])

  const choose = (o: ComboboxOption<T>) => {
    // A create in flight owns the outcome; picking another row now would be overwritten by it.
    if (creatingRef.current) return
    onChange(o.id)
    close(true)
  }

  /** See the header. Rejection is the caller's to explain — this only keeps the form intact. */
  const runCreate = async () => {
    if (!canCreate || !onCreateOption || creatingRef.current) return
    const name = createName
    creatingRef.current = true
    setCreating(true)
    try {
      const created = await onCreateOption(name)
      if (!mounted.current) return
      onChange(created.id)
      setQuery('')
      close(true)
    } catch {
      // The caller has already said why. Back to the search box with the name still in it.
      if (mounted.current) searchRef.current?.focus()
    } finally {
      creatingRef.current = false
      if (mounted.current) setCreating(false)
    }
  }

  const move = (step: number) => {
    const n = navCount
    if (!n) return
    setActive((cur) => {
      const i = cur < 0 ? (step > 0 ? 0 : n - 1) : cur + step
      return i < 0 ? n - 1 : i >= n ? 0 : i
    })
  }

  /**
   * Viewport coordinates, measured rather than guessed, and re-run on every scroll and resize —
   * the popper is in the top layer, so it does not travel with the field on its own.
   *
   * Flips above the trigger ONLY when below genuinely cannot hold it and above holds more; when
   * neither does, the list is squeezed to whatever room there is, down to `MIN_LIST`.
   */
  const place = useCallback(() => {
    const trigger = triggerRef.current
    const pop = popRef.current
    const list = listRef.current
    if (!trigger || !pop) return

    const r = trigger.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    if (list) list.style.maxHeight = '' // back to the CSS cap before re-measuring
    pop.style.width = `${r.width}px` // the popper IS the field wide
    pop.style.top = '0px'
    const left = Math.min(Math.max(r.left, EDGE), Math.max(EDGE, vw - EDGE - r.width))
    pop.style.left = `${Math.round(left)}px`

    let h = pop.offsetHeight
    const below = vh - r.bottom - GAP - EDGE
    const above = r.top - GAP - EDGE
    const up = h > below && above > below
    const room = Math.max(MIN_LIST, up ? above : below)
    if (h > room && list) {
      list.style.maxHeight = `${Math.max(MIN_LIST, list.offsetHeight - (h - room))}px`
      h = pop.offsetHeight
    }
    let top = up ? r.top - GAP - h : r.bottom + GAP
    top = Math.min(Math.max(top, EDGE), Math.max(EDGE, vh - EDGE - h))
    pop.style.top = `${Math.round(top)}px`
  }, [])

  /**
   * ⚠️ SHOWN FIRST, THEN PLACED — these two effects are ordered, not independent. `offsetHeight`
   * is 0 on a closed popover, so measuring before `showPopover()` pins the popper to the top of
   * the screen. Layout effects run in declaration order within a component and nothing paints
   * between them, so there is no flash at 0,0.
   *
   * No `hidePopover()` on the way out: the element is unmounted when `open` goes false, and
   * removing a popover from the DOM takes it out of the top layer for free.
   */
  useLayoutEffect(() => {
    if (!open) return
    const pop = popRef.current
    if (typeof pop?.showPopover !== 'function') return
    try {
      pop.showPopover()
    } catch {
      /* no popover support, or the attribute has not landed — placing still works */
    }
  }, [open])

  // …and re-placed whenever the filter changes the popper's height, so a shrinking list does not
  // leave it hanging below the viewport edge.
  useLayoutEffect(() => {
    if (open) place()
  }, [open, place, rows])

  /**
   * Hand-rolled rather than `scrollIntoView()`, which reaches past the box it is aimed at inside a
   * dialog and scrolls the form behind. `.cbx-list` is `relative`, so `offsetTop` is measured
   * against the scroller. Declared AFTER the effect that shows the popper: while it is closed the
   * list has `clientHeight` 0 and `scrollTop` cannot move at all.
   */
  useLayoutEffect(() => {
    if (!open) return
    const list = listRef.current
    const el = list?.querySelectorAll<HTMLElement>('[role="option"]')[active]
    if (!list || !el) return
    const t = el.offsetTop
    const h = el.offsetHeight
    if (t < list.scrollTop) list.scrollTop = t
    else if (t + h > list.scrollTop + list.clientHeight) list.scrollTop = t + h - list.clientHeight
  }, [open, active, rows])

  /**
   * ⚠️ FOCUS MUST LAND INSIDE THE POPPER, whichever half of the control is present. With the search
   * box it is the input; without it the listbox itself, which is why the list carries `tabIndex={-1}`
   * in that mode. Leave focus on the trigger and every arrow key below is dead, because the handler
   * lives on the popper and the event never reaches it.
   */
  useEffect(() => {
    if (!open) return
    if (searchable) searchRef.current?.focus()
    else listRef.current?.focus()
  }, [open, searchable])

  // Capture, and `pointerdown` rather than `click`: this has to run BEFORE the browser moves focus
  // to whatever was pressed, so an outside click never strands focus on <body> inside a modal and
  // never fights the control being clicked.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target
      if (!(t instanceof Node)) return
      if (popRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      close(true)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [open, close])

  // Capture on `scroll` too: the scroll that matters is the DIALOG BODY's, and `scroll` does not
  // bubble.
  useEffect(() => {
    if (!open) return
    const reflow = () => place()
    window.addEventListener('resize', reflow)
    window.addEventListener('scroll', reflow, true)
    return () => {
      window.removeEventListener('resize', reflow)
      window.removeEventListener('scroll', reflow, true)
    }
  }, [open, place])

  // Esc (or a backdrop click, on a `Modal` that opts into `closeOnBackdrop`) can close the dialog
  // out from under an open popper, which would
  // otherwise leave it stranded in the top layer over a page it no longer belongs to. No refocus:
  // the trigger is going away with the dialog, and `Modal` owns the restore.
  // ⚠️ The guard is an `instanceof` test, not `host !== document.body`: since the host may now be
  // the theme wrapper <div>, "not <body>" no longer means "is a dialog", and only a dialog fires
  // `close`.
  useEffect(() => {
    if (!open || !host || !(host instanceof HTMLDialogElement)) return
    const onHostClose = () => close(false)
    host.addEventListener('close', onHostClose)
    return () => host.removeEventListener('close', onHostClose)
  }, [open, host, close])

  const labelText = typeof label === 'string' ? label : undefined

  const renderOption = (o: ComboboxOption<T>, i: number) => (
    <div
      key={String(o.id)}
      id={optionId(i)}
      role="option"
      aria-selected={o.id === value}
      className={`cbx-opt${i === active ? ' is-active' : ''}`}
      onMouseMove={() => setActive(i)}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        choose(o)
      }}
    >
      <span className="cbx-text">{o.name}</span>
      <svg
        aria-hidden="true"
        className="cbx-check"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    </div>
  )

  return (
    <Field
      label={label}
      error={error}
      hint={hint}
      htmlFor={fieldId}
      labelId={labelId}
      errorId={errorId}
      className={[SHELL_BASE, open ? SHELL_OPEN : '', className].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        id={fieldId}
        ref={triggerRef}
        className="cbx-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        // BOTH ids. HTML-AAM names a <button> from its own SUBTREE, so the associated <label> is
        // skipped and the field would announce as bare "อาจารย์" with no idea what it answers.
        aria-labelledby={`${labelId} ${fieldId}`}
        aria-describedby={errorId}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => {
          if (open) {
            close(true)
            return
          }
          setQuery('')
          setOpen(true)
          onOpen?.()
        }}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
          e.preventDefault()
          if (open) return
          setQuery('')
          setOpen(true)
          onOpen?.()
        }}
      >
        {icon}
        <span className={`cbx-text${selected ? '' : ' cbx-ph'}`}>
          {selected ? selected.name : placeholder}
        </span>
        <svg
          aria-hidden="true"
          className="cbx-chev"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open &&
        host &&
        createPortal(
          <div
            ref={popRef}
            className="cbx-pop"
            popover="manual"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                // See the header: both calls, or the dropdown takes the form with it.
                e.preventDefault()
                e.stopPropagation()
                close(true)
                return
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                move(1)
                return
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                move(-1)
                return
              }
              if (e.key === 'Home') {
                e.preventDefault()
                setActive(0)
                return
              }
              if (e.key === 'End') {
                e.preventDefault()
                setActive(navCount - 1)
                return
              }
              if (e.key === 'Enter') {
                // The search box is outside the caller's <form>, so this cannot submit — stopped
                // anyway rather than relying on that.
                e.preventDefault()
                e.stopPropagation()
                // The create row when the keyboard is on it — or when it is the only row there is,
                // so typing a new name and pressing Enter does the obvious thing.
                if (canCreate && (active === createIndex || rows.flat.length === 0)) {
                  void runCreate()
                  return
                }
                const o = rows.flat[active]
                if (o) choose(o)
                return
              }
              // Tab: close, hand focus back, and let the browser compute the next stop FROM THE
              // TRIGGER. No preventDefault — that would trap the keyboard in a popper that is gone.
              if (e.key === 'Tab') close(true)
            }}
          >
            {searchable && (
              <div className="cbx-search">
                <svg
                  aria-hidden="true"
                  className="cbx-search-ico"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"
                  />
                </svg>
                {/* Once focus is IN here this is the combobox the screen reader is on, and the
                    highlight is an ACTIVE DESCENDANT rather than a focus move — the list must not
                    take focus or typing stops working. */}
                <input
                  ref={searchRef}
                  type="search"
                  className="cbx-search-input"
                  placeholder={SEARCH_PLACEHOLDER}
                  aria-label={labelText ? `ค้นหา${labelText}` : 'ค้นหาตัวเลือก'}
                  role="combobox"
                  aria-expanded
                  aria-autocomplete="list"
                  aria-controls={listId}
                  aria-activedescendant={activeId}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  // `readOnly`, not `disabled`: a disabled input drops focus, and the operator's
                  // caret has to still be here if the create is refused.
                  readOnly={creating}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            )}

            {/* The listbox is hidden rather than left as an empty padded strip — a 12px gap above
                "ไม่พบตัวเลือก…" reads as a rendering fault. `mousedown` is refused so the caret
                stays in the search box while a row is pressed.

                ⚠️ WITHOUT THE SEARCH BOX THIS BOX IS THE KEYBOARD TARGET, so it takes `tabIndex`
                and the `aria-activedescendant` the input would otherwise hold. With the search box
                it must NOT be focusable — stealing focus there stops typing working. */}
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              aria-labelledby={labelId}
              aria-activedescendant={
                !searchable && rows.flat.length ? optionId(active) : undefined
              }
              tabIndex={searchable ? undefined : -1}
              className="cbx-list"
              hidden={rows.flat.length === 0 && !canCreate}
              onMouseDown={(e) => e.preventDefault()}
            >
              {rows.plain.map((o, i) => renderOption(o, i))}
              {rows.reserved.length > 0 && (
                <div role="group" aria-labelledby={`${fieldId}-grp`}>
                  {/* A heading, never a choice: no role="option", never focusable, never
                      highlightable, and skipped by the arrow keys because it is not in `flat`. */}
                  <div id={`${fieldId}-grp`} className="cbx-group">
                    {RESERVED_GROUP}
                  </div>
                  {rows.reserved.map((o, i) => renderOption(o, rows.plain.length + i))}
                </div>
              )}

              {/* ── The create row ──
                  LAST, and in the listbox rather than under it: it has to be reachable by the same
                  arrow keys and the same `aria-activedescendant` as every row above, and the
                  keyboard-scroll effect finds it by the same `[role="option"]` query.
                  Primary ink rather than the rows' body colour, and a plus instead of a tick, so it
                  cannot be read as one more existing option that happens to match. The rule above it
                  separates it only when there ARE rows to separate it from. */}
              {canCreate && (
                <>
                  {rows.flat.length > 0 && (
                    <div aria-hidden="true" className="mx-1 my-1 border-t border-base-300" />
                  )}
                  <div
                    id={createId}
                    role="option"
                    aria-selected={false}
                    aria-disabled={creating || undefined}
                    aria-busy={creating || undefined}
                    className={`cbx-opt font-medium text-primary${active === createIndex ? ' is-active' : ''}${
                      creating ? ' cursor-progress' : ''
                    }`}
                    onMouseMove={() => setActive(createIndex)}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      void runCreate()
                    }}
                  >
                    {creating ? (
                      <Spinner />
                    ) : (
                      <svg
                        aria-hidden="true"
                        className="h-4.5 w-4.5 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    )}
                    <span className="cbx-text">
                      {creating ? `กำลังเพิ่ม “${createName}”…` : `เพิ่ม “${createName}”`}
                    </span>
                  </div>
                </>
              )}
            </div>

            {rows.flat.length === 0 && !canCreate && <p className="cbx-empty">{NO_MATCH}</p>}
          </div>,
          host,
        )}
    </Field>
  )
}

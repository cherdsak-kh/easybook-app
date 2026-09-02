import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * A searchable select that opens as a bottom sheet.
 * Ported from the prototype's `<dialog id="cbx-sheet">` (677–703) and module 3b (2728–2933).
 *
 * ── Why not a `<select>` ──
 * A native select's menu on mobile cannot be searched, and inside LINE's webview it is a plate
 * drawn by LINE/the OS that we cannot style at all. Once the list of positions and departments
 * runs to dozens of entries, finding a name becomes pure scrolling (PO, 30 August 2026).
 *
 * ── 🔴 THE BOTTOM SHEET IS THE ONE DOCUMENTED EXCEPTION TO "DIALOGS ARE ALWAYS CENTRED" ──
 * (`DECISIONS.md` §3.5.) That rule came from a CONFIRMATION box whose buttons kept being covered
 * by the URL bar — what lost was "a button you cannot reach". This is a VALUE PICKER that has to
 * open under the thumb with a scrollable list, so it is a different bet, and its bottom edge is
 * defended in two layers rather than fleeing to the middle: the height comes from `--vvh`, so
 * the sheet lifts above the keyboard on its own, and the list has a real floor of
 * `max(env(safe-area-inset-bottom), 1rem)`. Both live in `index.css`.
 *
 * ── ⚠️ "ONE `<dialog>`, NOT ONE PER FIELD" — how that rule is met here ──
 * The prototype has a single `<dialog>` shared by every field, because a second COPY OF THE
 * MARKUP is how two fields start behaving differently. In React the markup is written once, in
 * this file, and every field renders from it — the drift the rule guards against is structurally
 * impossible. What a second copy would still have cost is two sheets open at once, so the
 * module-level `openSheet` below keeps that to one.
 *
 * ── ⚠️ ESCAPE IS HANDLED BY HAND, NOT LEFT TO `<dialog>` ──
 * In WebKit, Escape inside a `type="search"` input clears the input first, so the sheet does not
 * close on the first press. The keydown handler on the search field closes it explicitly.
 *
 * ── ⚠️ EVERY WAY OUT FUNNELS THROUGH THE `close` EVENT ──
 * ✕, backdrop tap, Escape, picking an option, and a route change all end at the dialog's own
 * `close` event, which is where `aria-expanded`, the scroll lock and the focus restore are
 * undone. Cleaning up in the ✕ handler instead leaves the browser's own close paths stranding
 * `aria-expanded="true"` and a locked page — a bug that is hard to find because "it did close".
 * ⚠️ The backdrop reaches that event through an explicit `close()` rather than through daisyUI's
 * `<form method="dialog">`, because React 19 prevents that form's default — see the note on the
 * backdrop element itself.
 *
 * ── The selected row is marked three ways ──
 * Colour, a checkmark, and `aria-selected`. Colour alone is nothing to a colour-blind reader.
 *
 * ── 🔴 THE `<dialog>` IS PORTALLED OUT OF WHEREVER THIS FIELD SITS, AND IT HAS TO BE ──
 * daisyUI's backdrop is `<form method="dialog">`, so leaving the dialog inline puts a `<form>`
 * inside whatever form the field belongs to. `#/register` is the first screen to do that, and it
 * measured as **two nested `<form>` elements** plus a React console error saying so
 * (2 ก.ย. 2569). The *behaviour* happened to survive — the backdrop still closed the sheet and did
 * not submit the outer form — but nested forms are invalid HTML with no defined behaviour, and an
 * error logged on every render of the app's most important form is what hides the next real one.
 * The prototype has no such problem because its single `<dialog>` sits OUTSIDE `#reg-form`; the
 * portal is how that structure is restored.
 *
 * ⚠️ IT PORTALS TO THE NEAREST `[data-theme]` ANCESTOR, **NOT** TO `document.body`. Both portals
 * escape the form, but `document.body` is outside the element `ClientRoutes` stamps the theme on,
 * so the sheet would render in daisyUI's default palette while the page behind it stayed in the
 * portal's — the top layer changes where an element paints, not which tokens it inherits.
 */

export type ComboboxOption = {
  /** Stable identity. Numeric ids from the API should be stringified by the caller. */
  value: string
  label: string
}

/** At most one sheet may be open across the whole app; this is what enforces it. */
let openSheet: HTMLDialogElement | null = null

export function Combobox({
  id,
  label,
  options,
  value,
  onChange,
  placeholder,
  /** Sheet title. Falls back to the placeholder so the same Thai string is not written twice. */
  sheetTitle,
  error,
  disabled = false,
  searchPlaceholder = 'พิมพ์ค้นหา...',
  emptyText = 'ไม่พบรายการที่ค้นหา',
}: {
  id: string
  label: string
  options: readonly ComboboxOption[]
  /** The selected option's `value`, or `''` for none. */
  value: string
  onChange: (value: string) => void
  placeholder: string
  sheetTitle?: string
  /** Thai validation message. Presence also wires `select-error` and `aria-describedby`. */
  error?: string
  disabled?: boolean
  searchPlaceholder?: string
  emptyText?: string
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  /* Resolved after mount, because the trigger's ref is not available during the first render.
     Until then the sheet simply is not in the tree — which is correct: it is closed anyway. */
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalHost(triggerRef.current?.closest('[data-theme]') ?? document.body)
  }, [])

  const labelId = `${id}-label`
  const errId = `${id}-err`
  const listId = useId()

  const chosen = options.find((o) => o.value === value)

  /* ⚠️ `toLowerCase()` on BOTH sides. Thai has no letter case, but position and department names
     can contain English (a project name), and nobody searching is being careful about it. */
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  /* The initially highlighted row is the CURRENT selection when it survives the filter, else the
     first result — so pressing Enter straight after typing takes the row the eye is on, not one
     left over from the previous query. */
  useEffect(() => {
    if (!expanded) return
    const i = shown.findIndex((o) => o.value === value)
    setActive(shown.length ? (i > -1 ? i : 0) : -1)
  }, [expanded, shown, value])

  /* Keep the highlighted row in view when the arrow keys walk past the fold. `block: 'nearest'`
     with the `scroll-margin-block` in `.cbx-opt` keeps it off the sticky search row. */
  useEffect(() => {
    if (active < 0) return
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const close = useCallback(() => dialogRef.current?.close(), [])

  const open = useCallback(() => {
    const dlg = dialogRef.current
    if (!dlg || dlg.open || disabled) return
    /* Never two at once — see the note about what the shared `<dialog>` was really buying. */
    openSheet?.close()
    openSheet = dlg
    setQuery('')
    setExpanded(true)
    document.documentElement.setAttribute('data-sheet-open', '')
    dlg.showModal()
    /* `showModal()` focuses the first focusable child, which is the ✕ — not what someone who
       opened a searchable list came to do. The keyboard it raises does not cover the list,
       because the sheet's height is bound to the visual viewport. */
    searchRef.current?.focus()
  }, [disabled])

  /* ⚠️ Navigating away while the sheet is open (LIFF's back button reaches us this way, per
     `D-C3`) must not leave it stranded over the next screen. */
  useEffect(() => {
    if (!expanded) return
    const onPop = () => close()
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [expanded, close])

  /* The single cleanup point every close path funnels into. */
  const handleClose = useCallback(() => {
    if (openSheet === dialogRef.current) openSheet = null
    setExpanded(false)
    setActive(-1)
    document.documentElement.removeAttribute('data-sheet-open')
    /* Focus returns to the trigger — unless the screen holding it has gone, in which case
       returning focus would put it somewhere invisible. */
    if (triggerRef.current?.offsetParent !== null) triggerRef.current?.focus()
  }, [])

  const choose = useCallback(
    (option: ComboboxOption) => {
      onChange(option.value)
      close()
    },
    [onChange, close],
  )

  /** Wrap at both ends rather than stopping — the lists are short, and OS menus have always wrapped. */
  const move = (delta: number) => {
    if (!shown.length) return
    setActive((prev) => {
      const n = shown.length
      if (prev < 0) return delta > 0 ? 0 : n - 1
      return (prev + delta + n) % n
    })
  }

  return (
    <div>
      <label id={labelId} htmlFor={`${id}-btn`} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>

      {/* ⚠️ `role="combobox"` MUST NOT take its name from its own contents, so `aria-labelledby`
          points at TWO things: the field label, then this button. With the label alone, the
          currently selected value goes unannounced and a screen-reader user has to open the
          sheet just to learn what is already chosen.
          The `select select-lg` pair is deliberate — the trigger borrows the real field's
          height, border, radius and focus ring, so it IS the same control, not a lookalike. */}
      <button
        ref={triggerRef}
        type="button"
        id={`${id}-btn`}
        disabled={disabled}
        onClick={open}
        onKeyDown={(e) => {
          /* Arrow keys open it too — the combobox convention, and the first key a keyboard user
             reaches for. */
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            open()
          }
        }}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-labelledby={`${labelId} ${id}-btn`}
        aria-describedby={error ? errId : undefined}
        /* ⚠️ `aria-invalid` AS WELL AS `select-error`, because they carry the same fact to two
           different readers and only one of them can see a red ring. Measured missing while
           wiring `#/register` (2 ก.ย. 2569): the three `<input>`s announced themselves as invalid
           and these two did not, so a screen-reader user heard four failures out of five. The
           prototype sets it on its trigger too (2678). */
        aria-invalid={error ? true : undefined}
        className={`select select-lg cbx-trigger w-full ${error ? 'select-error' : ''}`.trim()}
      >
        <span className={`min-w-0 truncate ${chosen ? '' : 'opacity-60'}`}>
          {chosen ? chosen.label : placeholder}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
          className="cbx-caret h-5 w-5 shrink-0 opacity-60"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {error ? (
        <p id={errId} className="mt-1 text-xs text-error">
          {error}
        </p>
      ) : null}

      {/* `modal-bottom` — the documented exception, see the header comment. The enter/exit
          animation is entirely daisyUI's (`transition: overlay .3s allow-discrete` holds the
          element in the top layer until the slide finishes), which is why nothing here ever adds
          `hidden` or `display:none` on top: that is the one thing that cuts the closing beat
          short and makes the sheet blink out.
          ⚠️ Portalled — see the header. React events still bubble through the component tree, so
          nothing else about this markup changes. */}
      {portalHost
        ? createPortal(
            <dialog
        ref={dialogRef}
        onClose={handleClose}
        className="cbx-sheet modal modal-bottom"
        aria-labelledby={`${id}-sheet-title`}
      >
        <div className="modal-box">
          <div className="flex items-center gap-2 border-b border-base-300 px-5 py-3">
            <h2 id={`${id}-sheet-title`} className="grow truncate text-base font-semibold">
              {sheetTitle ?? placeholder}
            </h2>
            {/* ⚠️ `min-h-11 min-w-11` IS AN ADDITION TO THE PROTOTYPE'S CLASS LIST, NOT A PORT
                ERROR. Measured in the browser at 390px, `btn-sm btn-circle` renders 32 × 32 —
                under the 44px floor the Phase 1 exit gate sets for an icon-only control, and it
                is the only close affordance a thumb can aim at. The button is `btn-ghost`, whose
                background is transparent until hover or focus, so at rest NOTHING about the
                design changes: the visible mark is still the 20px ✕. What grows is the hit area
                and the hover disc. Same reasoning on the clear button below, which measured
                24 × 24. */}
            <button
              type="button"
              onClick={close}
              className="btn btn-ghost btn-sm btn-circle min-h-11 min-w-11"
              aria-label="ปิด"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
                className="h-5 w-5"
              >
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {/* The search row sits OUTSIDE the scroll area, so it stays under the title without
              needing `position: sticky`. */}
          <div className="border-b border-base-300 px-5 py-3">
            <label className="input input-lg flex w-full items-center gap-2">
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
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    move(1)
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    move(-1)
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    if (active > -1 && shown[active]) choose(shown[active])
                  } else if (e.key === 'Escape') {
                    /* ⚠️ WebKit spends the first Escape clearing a `type="search"` field, so the
                       sheet would not close until the second press. Taken by hand. */
                    e.preventDefault()
                    close()
                  }
                }}
                className="cbx-search grow"
                placeholder={searchPlaceholder}
                aria-label="ค้นหาในรายการ"
                aria-controls={listId}
                aria-activedescendant={active > -1 ? `${id}-opt-${active}` : undefined}
                enterKeyHint="done"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    searchRef.current?.focus()
                  }}
                  className="btn btn-ghost btn-xs btn-circle min-h-11 min-w-11"
                  aria-label="ล้างคำค้นหา"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                  >
                    <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              ) : null}
            </label>
          </div>

          <div className="cbx-scroll">
            {/* ⚠️ `role="listbox"`/`role="option"` are written by hand because daisyUI has no
                listbox: `menu` is navigation links and `list` is data rows, and both are the
                wrong meaning for "choose one value". */}
            <ul ref={listRef} id={listId} role="listbox" aria-labelledby={`${id}-sheet-title`}>
              {shown.map((o, i) => (
                <li
                  key={o.value}
                  id={`${id}-opt-${i}`}
                  role="option"
                  aria-selected={o.value === value}
                  {...(i === active ? { 'data-active': '' } : {})}
                  onClick={() => choose(o)}
                  onMouseMove={() => setActive(i)}
                  className="cbx-opt"
                >
                  <span className="cbx-opt-label">{o.label}</span>
                  {o.value === value ? (
                    <span aria-hidden="true">
                      {/* The same checkmark the gate's completed steps draw — not redrawn. */}
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="cbx-opt-check"
                      >
                        <path d="M4 12.5l5 5L20 6.5" />
                      </svg>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            {shown.length === 0 ? (
              <p className="px-5 py-10 text-center text-base-content/60">{emptyText}</p>
            ) : null}
          </div>
        </div>
        {/* ── 🔴 A `<div>` BACKDROP WITH AN EXPLICIT `close()`, NOT daisyUI'S `<form method="dialog">` ──
            The canonical daisyUI markup is `<form method="dialog" class="modal-backdrop"><button>`,
            which closes the dialog through the FORM's default action and needs no handler. Under
            **React 19 that default is prevented**: measured 2 ก.ย. 2569 on `#/register`, the submit
            event fired with `defaultPrevented === true` and the sheet stayed open — `dialog.open`
            still `true`, `aria-expanded` still `"true"`, the scroll lock still on. React owns
            `<form>` submits now (Actions), and a form with no `action` still does not reach the
            browser's dialog behaviour.

            ⚠️ IT LOOKED FINE UNTIL THE DIALOG WAS PORTALLED, WHICH IS THE WORST WAY FOR THIS TO
            HAVE BEEN TRUE. While the sheet still rendered inline it was an invalid nested `<form>`,
            React did not treat it as its own, and the native close ran — the broken markup was
            masking the broken behaviour. Fixing the nesting is what exposed it.

            daisyUI documents this `<div class="modal-backdrop"><button>` shape too, so the styling
            is unchanged. The header's promise still holds: `close()` fires the dialog's own `close`
            event, which is where `aria-expanded`, the scroll lock and the focus restore are undone,
            so this path lands exactly where ✕, Escape and picking an option land. */}
        <div className="modal-backdrop">
          <button type="button" onClick={close}>
            ปิด
          </button>
        </div>
            </dialog>,
            portalHost,
          )
        : null}
    </div>
  )
}

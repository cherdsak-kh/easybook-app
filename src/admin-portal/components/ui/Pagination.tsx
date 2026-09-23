/**
 * ก่อนหน้า · 1 2 3 · ถัดไป — the pager under every table.
 *
 * ⚠️ Server-side, unlike the prototype. There, `apply()` filtered and sliced rows already in
 * the browser; here the page holds ONE page and `GET /line-users?page=` fetches the next. So
 * this component owns no data — it takes `page` and `pages` and reports a click.
 *
 * `aria-current="page"` marks the active number. Without it the current page is conveyed by
 * colour alone, which is both a contrast question and useless to a screen reader; with it the
 * number announces as "หน้า 2, current page".
 *
 * The prev/next buttons are `disabled` at the ends rather than removed. Removing them shifts
 * every remaining control sideways at the exact moment the operator is aiming at one — and
 * `.page-btn` already styles the disabled state as `cursor: not-allowed`, which is why the
 * base-layer pointer-cursor rule excludes `:disabled`.
 *
 * ── `long` — the same pager for a table with no ceiling ──
 * ⚠️ EXTENDED, NOT FORKED (4 ก.ย. 2569, คำขอจองสถานที่). The short form above prints EVERY page,
 * and the note that used to sit here said windowing would be designed when a table got long enough
 * to need it. คำขอจองสถานที่ is that table: it is every booking the school has ever taken, across
 * every term, and the prototype designs the answer — so this is the designed control, not an
 * invented one.
 *
 * `long` turns on exactly three things, and nothing else about the component moves:
 *   · first/last jumps (`«` / `»`) — "back to the newest" from page 14 should not be 13 clicks;
 *   · a SEVEN-number window with `…` elision, always including 1 and the last page — 38 pages as
 *     38 buttons is a control that wraps to four lines and is slower to read than the arrows
 *     beside it;
 *   · `min-w-11` on the single-glyph buttons. `.page-btn`'s padding gives a "«" a 39px box, which
 *     is a 44px-TALL target you can miss sideways. Measured, and the reason it is not left to the
 *     class: `.page-num` already carries its own `min-w-11`, these two did not.
 *
 * Off (the default) the output is byte-for-byte what การลงทะเบียน and เจ้าหน้าที่ระบบ rendered
 * before this prop existed.
 */

const PREV = 'ก่อนหน้า'
const NEXT = 'ถัดไป'

/**
 * At most seven numbers, always including 1 and `pages`, with the current page centred.
 *
 * Returns `'…'` for a gap. It is a STRING in the array rather than a `null`, so the caller renders
 * from one list in one pass — a second array of gap positions is a second thing to keep in step.
 */
function windowOf(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  const lo = Math.max(2, page - 2)
  const hi = Math.min(pages - 1, page + 2)
  if (lo > 2) out.push('…')
  for (let n = lo; n <= hi; n += 1) out.push(n)
  if (hi < pages - 1) out.push('…')
  out.push(pages)
  return out
}

export function Pagination({
  page,
  pages,
  onGo,
  label = 'แบ่งหน้า',
  long = false,
}: {
  page: number
  pages: number
  onGo: (page: number) => void
  label?: string
  /** See the header. Leave it off for a table whose row count is bounded by the school's size. */
  long?: boolean
}) {
  if (pages <= 1) return null

  const numbers: (number | '…')[] = long
    ? windowOf(page, pages)
    : Array.from({ length: pages }, (_, i) => i + 1)

  /** One arrow/jump button. `on` is "this click would go somewhere", which is also `!disabled`. */
  const step = (
    text: string,
    on: boolean,
    go: number,
    aria?: string,
    glyphOnly = false,
  ) => (
    <button
      key={aria ?? text}
      type="button"
      disabled={!on}
      aria-label={aria}
      onClick={() => onGo(go)}
      className={`page-btn ${glyphOnly ? 'min-w-11 ' : ''}${on ? 'page-btn-on' : ''}`.trim()}
    >
      {text}
    </button>
  )

  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-center gap-1.5">
      {long && step('«', page > 1, 1, 'หน้าแรก', true)}
      {step(long ? `‹ ${PREV}` : PREV, page > 1, page - 1)}

      {numbers.map((n, i) =>
        n === '…' ? (
          /* Decorative: the gap is conveyed by the numbers that survive it, and a screen reader
             reading "ellipsis" between two page buttons learns nothing it can act on.
             Keyed by the number BEFORE it — there can be two gaps in one window, and a bare index
             key would let React reuse the leading one as the trailing one across a page change. */
          <span
            key={`gap-${String(numbers[i - 1] ?? 'start')}`}
            aria-hidden="true"
            className="px-1 text-[14px] text-base-content/60"
          >
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            disabled={n === page}
            aria-current={n === page ? 'page' : undefined}
            aria-label={long ? `หน้า ${n}` : undefined}
            onClick={() => onGo(n)}
            className={`page-num ${n === page ? 'page-num-active' : ''}`.trim()}
          >
            {n}
          </button>
        ),
      )}

      {step(long ? `${NEXT} ›` : NEXT, page < pages, page + 1)}
      {long && step('»', page < pages, pages, 'หน้าสุดท้าย', true)}
    </nav>
  )
}

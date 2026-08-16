/**
 * ก่อนหน้า · 1 2 3 · ถัดไป — the pager under all three tables.
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
 * The number list is deliberately NOT windowed with ellipses yet. The prototype prints every
 * page, and at the sizes measured (13 staff, hundreds of registrations at 10/page) that stays
 * short. Windowing is a design decision with its own edge cases and there is no prototype for
 * it — so it goes to NEEDS_DESIGN when a table gets long enough to need it, not invented here.
 */

export function Pagination({
  page,
  pages,
  onGo,
  label = 'แบ่งหน้า',
}: {
  page: number
  pages: number
  onGo: (page: number) => void
  label?: string
}) {
  if (pages <= 1) return null

  const numbers = Array.from({ length: pages }, (_, i) => i + 1)

  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-center gap-1.5">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onGo(page - 1)}
        className={`page-btn ${page > 1 ? 'page-btn-on' : ''}`.trim()}
      >
        ก่อนหน้า
      </button>

      {numbers.map((n) => (
        <button
          key={n}
          type="button"
          disabled={n === page}
          aria-current={n === page ? 'page' : undefined}
          onClick={() => onGo(n)}
          className={`page-num ${n === page ? 'page-num-active' : ''}`.trim()}
        >
          {n}
        </button>
      ))}

      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onGo(page + 1)}
        className={`page-btn ${page < pages ? 'page-btn-on' : ''}`.trim()}
      >
        ถัดไป
      </button>
    </nav>
  )
}

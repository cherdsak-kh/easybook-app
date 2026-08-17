/**
 * Loading placeholders — `sk` / `sk-soft` / `sk-box` in the prototype.
 *
 * ⚠️ A skeleton earns its place ONLY if it has the same shape as what replaces it. The
 * prototype's earlier version was three generic bars: it matched neither the desktop table
 * nor the mobile card, so content jumped the moment it arrived — which is the one thing a
 * skeleton exists to prevent. These are the pieces; the page composing them owes the layout,
 * including a `table-layout: fixed` colgroup where the real table has one, because an
 * auto-layout table sizes columns to their widest CONTENT and a skeleton's content is bars.
 *
 * Every piece is decorative and carries no text. The CONTAINER gets `aria-busy` and ONE
 * `sr-only` line — see `<SkeletonRegion>`. A screen reader should be told "กำลังโหลด" once,
 * not read forty empty bars.
 *
 * `sk-soft` is the dimmer variant for a second-rank line (a subtitle under a name), so a
 * skeleton block has the same visual hierarchy as the content it stands in for.
 */

export function Skeleton({
  variant = 'bar',
  className = '',
  width,
}: {
  /** `bar` = pill-shaped text line, `soft` = dimmer second-rank line, `box` = avatar/tile. */
  variant?: 'bar' | 'soft' | 'box'
  className?: string
  /** Anything CSS accepts — `'60%'`, `'8rem'`. Widths belong to the layout, not here. */
  width?: string
}) {
  const cls = variant === 'soft' ? 'sk-soft' : variant === 'box' ? 'sk-box' : 'sk'
  return <span aria-hidden="true" className={`block ${cls} ${className}`.trim()} style={{ width }} />
}

/**
 * The wrapper that makes a field of skeletons legible to assistive tech: `aria-busy` on the
 * region plus exactly one announcement. Wrap the skeleton layout in this rather than
 * labelling individual bars.
 */
export function SkeletonRegion({
  label,
  children,
  className = '',
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div aria-busy="true" className={className}>
      <span className="sr-only" role="status">
        {label}
      </span>
      {children}
    </div>
  )
}

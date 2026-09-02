import type { ReactNode } from 'react'

/**
 * Loading placeholders. Prototype: `withSkeleton()` at 3668–3673, plus the shapes at 909–927
 * (home) and 3411–3415 (a venue card).
 *
 * 🔴 A SKELETON HAS EXACTLY ONE JOB: TO STOP THE PAGE JUMPING WHEN THE DATA ARRIVES. It follows
 * that a placeholder whose height differs from the real thing is worse than none at all — it
 * spends the loading time promising a layout it then breaks. Match the real element's shape
 * (`aspect-video` cover, `card-body p-4` padding, the same number of rows), not just its area.
 *
 * ⚠️ THE PROTOTYPE'S `LOAD_MS = 650` DID NOT COME ACROSS, on purpose. It was a fake delay so a
 * reviewer could SEE the skeleton; here the switch is the real request's pending state.
 *
 * ⚠️ DO NOT FLASH A SKELETON ON A REPAINT. When an approval arrives over the socket and a list
 * is redrawn, the data is already in hand — a skeleton there looks like a reload the user did
 * not ask for. Skeletons are for the first fetch of a screen.
 */

/**
 * One placeholder block. Give it `h-*` and `w-*`; daisyUI's `skeleton` supplies the animation
 * and the surface.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`.trim()} />
}

/**
 * The React form of `withSkeleton(skelId, bodyId, paint)`: one boolean chooses between the
 * placeholder and the real body.
 *
 * ⚠️ `aria-hidden` + `aria-busy` ON THE PLACEHOLDER BRANCH. The shapes carry no information, so
 * a screen reader should skip them entirely — but it should still be told that the region is
 * loading, or the announcement is simply an empty area.
 */
export function SkeletonSwap({
  loading,
  skeleton,
  children,
}: {
  loading: boolean
  /** The placeholder shape. Must match the real content's height. */
  skeleton: ReactNode
  children: ReactNode
}) {
  if (loading) {
    return (
      <div aria-busy="true" aria-hidden="true">
        {skeleton}
      </div>
    )
  }
  return <>{children}</>
}

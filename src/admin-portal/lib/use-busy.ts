/**
 * The double-submit guard, in its own module so `Spinner.tsx` exports components only —
 * oxlint's `only-export-components` is not style advice: a module mixing components with
 * plain exports loses Fast Refresh and reloads the whole page on every edit.
 *
 * `disabled` alone is not an honest busy state: a greyed-out button with no motion reads as
 * broken rather than working, and a screen-reader user gets nothing at all. So all three —
 * `disabled` blocks the second click, a spinner says work is happening, and `aria-busy` plus
 * a changed `aria-label` say the same thing without eyes.
 *
 * ⚠️ THE VISIBLE LABEL NEVER CHANGES, and that is why no width pinning is needed here. The
 * prototype's first attempt swapped the text for "กำลังโหลด…" and pinned `min-width`;
 * measured, รีเฟรช went 97px → 129px, because a min-width stops a box shrinking, not growing
 * — and those 32px shoved the button beside it sideways mid-click. The busy wording goes to
 * assistive tech through `aria-label`, where it costs no pixels. Verified in the browser: the
 * button holds 93px across idle → busy → idle.
 */

import { useCallback, useRef, useState } from 'react'

export function useBusy() {
  const [busy, setBusy] = useState(false)
  // Guards the re-entrant click landing between the handler firing and React committing the
  // disabled state — `disabled` applies on the next render, not on this tick.
  const running = useRef(false)

  const run = useCallback(async (task: () => unknown | Promise<unknown>) => {
    if (running.current) return
    running.current = true
    setBusy(true)
    try {
      await task()
    } finally {
      running.current = false
      setBusy(false)
    }
  }, [])

  const buttonProps = useCallback(
    (busyLabel?: string) => ({
      disabled: busy,
      'aria-busy': busy || undefined,
      'aria-label': busy ? busyLabel : undefined,
    }),
    [busy],
  )

  return { busy, run, buttonProps }
}

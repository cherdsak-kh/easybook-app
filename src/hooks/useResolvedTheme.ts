import { useEffect, useState } from 'react'

/**
 * The portal identities. There is exactly ONE since 2026-08-16: the old back-office was
 * deleted along with its `easybook-admin(-dark)` themes.
 *
 * ⚠️ The union is kept rather than collapsed into a bare string so the parameter still reads
 * as a choice — and so re-adding a portal means adding a theme block, not discovering at
 * runtime that `data-theme` points at a theme nobody defined. v2 brings its own theming from
 * the prototype and will not come back through this hook.
 */
export type Portal = 'client'

export type ResolvedTheme = 'easybook-client' | 'easybook-client-dark'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function matchDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(DARK_QUERY).matches
  )
}

/**
 * Resolves the daisyUI `data-theme` for a portal from the OS colour-scheme
 * preference — the SAME trigger the codebase's `dark:` variants used before the
 * redesign, so light/dark behaviour is unchanged (AC-6). This is the single
 * place `prefers-color-scheme` is read: the redefined `dark` variant in
 * `index.css` then makes any not-yet-migrated `dark:` utility follow the very
 * `data-theme` this hook sets. If a manual light/dark toggle is ever wanted, it
 * is a localized change to this hook only.
 */
export function useResolvedTheme(portal: Portal): ResolvedTheme {
  // One identity, so no branch. The parameter stays because the CALLER still declares
  // which portal it is, and a second identity would reintroduce the choice here.
  void portal
  const base = 'easybook-client' as const
  const [dark, setDark] = useState<boolean>(matchDark)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(DARK_QUERY)
    const onChange = (event: MediaQueryListEvent) => setDark(event.matches)
    mql.addEventListener('change', onChange)
    // Re-sync in case the preference changed between first render and effect.
    setDark(mql.matches)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return (dark ? `${base}-dark` : base) as ResolvedTheme
}

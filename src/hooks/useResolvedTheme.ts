import { useEffect, useState } from 'react'

/** The two portal identities; each resolves to a light or `-dark` daisyUI theme. */
export type Portal = 'client' | 'admin'

export type ResolvedTheme =
  | 'easybook-client'
  | 'easybook-client-dark'
  | 'easybook-admin'
  | 'easybook-admin-dark'

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
  const base = portal === 'admin' ? 'easybook-admin' : 'easybook-client'
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

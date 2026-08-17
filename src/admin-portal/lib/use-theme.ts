/**
 * Theme choice — `'light' | 'dark' | 'system'`.
 *
 * ⚠️ WHAT IS PERSISTED IS THE CHOICE, NEVER THE COLOUR IT RESOLVED TO. Saving "dark" because
 * the OS was dark at 9pm leaves the app dark at noon tomorrow with nothing on screen able to
 * explain why. `system` is a standing instruction, not a one-time reading.
 *
 * ⚠️ It is LIVE, not read-once. Someone on `system` whose OS flips at sunset must see the app
 * follow without a reload — that is the `change` listener, and dropping it is the difference
 * between "follows the system" and "followed the system once, at mount".
 *
 * This hook does NOT touch the DOM. The prototype wrote `data-theme` onto
 * `document.documentElement` because it was the whole page; here the app also serves the LIFF
 * client with its own theme, so the resolved name is returned and the admin shell stamps it
 * onto its own wrapper (P2). One writer, and it is the element that owns the subtree.
 *
 * ⚠️ A FOUC guard still has to exist, and it cannot live here. React runs after the browser
 * has already painted, so a dark-mode operator gets a full-brightness white flash on every
 * load unless a blocking inline script in `index.html` stamps the attribute first. That is
 * P2's job; this hook is what keeps it correct afterwards.
 */

import { useCallback, useEffect, useState } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'
export type ResolvedAdminTheme = 'easybook-admin' | 'easybook-admin-dark'

/** Must match the key the `index.html` FOUC guard reads, or the two disagree on first paint. */
export const THEME_KEY = 'easybook-admin-theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
  } catch {
    // Private mode, or storage disabled. `system` is the safe default: it is the only value
    // that is right without being remembered.
    return 'system'
  }
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(readChoice)
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia(DARK_QUERY).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(DARK_QUERY)
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const setTheme = useCallback((next: ThemeChoice) => {
    setChoice(next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // Storage refused. The choice still applies for this session — refusing to change the
      // theme because it cannot be remembered would be the worse failure.
    }
  }, [])

  const isDark = choice === 'dark' || (choice === 'system' && systemDark)
  const resolved: ResolvedAdminTheme = isDark ? 'easybook-admin-dark' : 'easybook-admin'

  return { choice, setTheme, resolved, isDark }
}

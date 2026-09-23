import { useEffect, useState, useSyncExternalStore } from 'react'

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

/**
 * What the user PICKED, which is not the same thing as what it resolved to.
 *
 * ⚠️ THE CHOICE IS PERSISTED, NEVER THE COLOUR. Saving `dark` because the phone happened to be
 * dark at 9pm leaves the app dark at noon tomorrow with nothing on screen able to explain why.
 * `system` is a standing instruction, not a one-time reading — which is why the `change`
 * listener below is not optional either.
 */
export type ThemeChoice = 'light' | 'dark' | 'system'

/**
 * 🔴 THE KEY AND ITS THREE VALUES ARE THE PROTOTYPE'S, CHARACTER FOR CHARACTER (module 7, 5634).
 * It is written down there as the one thing that must not be changed in a single place, because a
 * FOUC guard reading the same key before the stylesheet loads is the reason a dark-theme session
 * does not flash white. This app has no such guard yet; when one is added it reads THIS constant.
 */
export const CLIENT_THEME_KEY = 'easybook-client-theme'

/**
 * `system`, matching the prototype's `themePref()` — NOT the admin portal's `light`.
 *
 * ⚠️ The two portals differ on purpose. The back-office runs on desks whose OS setting nobody
 * chose deliberately; this one runs inside LINE on a personal phone, where "dark mode" is a
 * decision its owner already made. Defaulting to `light` there overrides an explicit preference
 * with a guess, and it would also be a silent behaviour change: the client portal has followed
 * `prefers-color-scheme` since v1.
 */
const DEFAULT_CHOICE: ThemeChoice = 'system'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function matchDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(DARK_QUERY).matches
  )
}

function readChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(CLIENT_THEME_KEY)
    return stored === 'light' || stored === 'dark' || stored === 'system'
      ? stored
      : DEFAULT_CHOICE
  } catch {
    // Private mode, or storage disabled. Refusing to render a theme because the choice cannot be
    // remembered would be the worse failure.
    return DEFAULT_CHOICE
  }
}

/**
 * ── 🔴 ONE STORE, MODULE-LEVEL, BECAUSE TWO COMPONENTS READ THE SAME VALUE ──
 * `ClientRoutes` stamps `data-theme` from it and `#/settings` draws the three buttons from it.
 * Held in `useState` inside the hook, those two would be independent copies: picking "มืด" on the
 * settings screen would repaint nothing, or repaint and leave the buttons highlighting "สว่าง".
 * That is the exact bug the prototype fixed when its review bar and its settings screen started
 * disagreeing (module 7) — there, as here, the fix is a single writer.
 */
let choice: ThemeChoice = readChoice()
const listeners = new Set<() => void>()

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

function snapshot(): ThemeChoice {
  return choice
}

/**
 * Record a new choice. The ONLY writer of {@link CLIENT_THEME_KEY}.
 *
 * ⚠️ It does not touch the DOM. `ClientRoutes` owns the `data-theme` attribute on the element that
 * owns the subtree; a second writer here is how a portal ends up with two attributes disagreeing.
 */
export function setThemeChoice(next: ThemeChoice): void {
  if (next === choice) return
  choice = next
  try {
    localStorage.setItem(CLIENT_THEME_KEY, next)
  } catch {
    // Storage refused. The choice still applies for this session.
  }
  for (const listener of listeners) listener()
}

/** The stored choice — `light` · `dark` · `system`. Live across every component that reads it. */
export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

/**
 * Resolves the daisyUI `data-theme` for a portal: the stored choice, with `system` answered by
 * `prefers-color-scheme`. This is the single place that media query is read, and the redefined
 * `dark` variant in `index.css` then makes any not-yet-migrated `dark:` utility follow the very
 * `data-theme` this hook resolves.
 *
 * ⚠️ THE OS LISTENER STAYS EVEN THOUGH A CHOICE NOW EXISTS. Somebody on `system` whose phone flips
 * at sunset must see the app follow without a reload — LIFF lives in a webview that is not
 * reloaded for days. Dropping it turns "follow the system" into "followed the system once".
 */
export function useResolvedTheme(portal: Portal): ResolvedTheme {
  // One identity, so no branch. The parameter stays because the CALLER still declares
  // which portal it is, and a second identity would reintroduce the choice here.
  void portal
  const base = 'easybook-client' as const
  const pick = useThemeChoice()
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

  const isDark = pick === 'dark' || (pick === 'system' && dark)
  return (isDark ? `${base}-dark` : base) as ResolvedTheme
}

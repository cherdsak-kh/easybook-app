import liff from '@line/liff'

/** Minimal LINE profile shape used by the UI. */
export interface LiffProfile {
  displayName: string
  userId: string
  pictureUrl?: string
}

/**
 * Whether a LIFF id is configured (`VITE_LIFF_ID` set).
 *
 * This is the single source of truth for "is LIFF real here?": when it returns
 * `false` the app is running outside a registered LINE channel (e.g. a plain dev
 * browser), so every helper below short-circuits to a safe fallback instead of
 * touching the un-initialised SDK. `HomePage` gates its dev-only mock-login
 * affordance on this same signal so the mock never fires when LIFF is real.
 */
export function isLiffConfigured(): boolean {
  return Boolean(import.meta.env.VITE_LIFF_ID)
}

/**
 * Whether the app is running inside the LINE in-app browser (the LIFF client),
 * as opposed to an external web browser.
 *
 * Fails soft to `false` when LIFF is unconfigured or the SDK has not initialised
 * yet, so it is always safe to call (including during render).
 */
export function isInLineClient(): boolean {
  if (!isLiffConfigured()) return false
  try {
    return liff.isInClient()
  } catch {
    return false
  }
}

/**
 * Whether the LINE user currently has an active LIFF session.
 * Fails soft to `false` when LIFF is unconfigured/unavailable.
 */
export function isLoggedIn(): boolean {
  if (!isLiffConfigured()) return false
  try {
    return liff.isLoggedIn()
  } catch {
    return false
  }
}

/**
 * Start the LINE login redirect. No-op (never throws) when LIFF is unconfigured
 * or unavailable, so a plain dev browser never triggers a redirect that would
 * fail — callers should gate any dev fallback on {@link isLiffConfigured}.
 */
export function login(redirectUri?: string): void {
  if (!isLiffConfigured()) return
  try {
    liff.login(redirectUri ? { redirectUri } : undefined)
  } catch (error) {
    console.warn('[liff] login failed:', error)
  }
}

/**
 * Fetch the signed-in user's profile, or `null` when LIFF is unconfigured, the
 * user is not logged in, or the SDK call fails. Assumes {@link initLiff} (i.e.
 * `liff.init`) has already run.
 */
export async function getProfile(): Promise<LiffProfile | null> {
  if (!isLiffConfigured()) return null
  try {
    if (!liff.isLoggedIn()) return null
    const profile = await liff.getProfile()
    return {
      displayName: profile.displayName,
      userId: profile.userId,
      pictureUrl: profile.pictureUrl,
    }
  } catch (error) {
    console.warn('[liff] getProfile failed:', error)
    return null
  }
}

/** Result of a friendship check with the LINE Official Account. */
export interface Friendship {
  /** `true` when the user has added the OA as a friend (or when LIFF is not real). */
  friendFlag: boolean
}

/**
 * Whether the signed-in user has added the LINE Official Account as a friend.
 *
 * Fails **open** (`{ friendFlag: true }`) when LIFF is unconfigured (local dev /
 * plain browser) or the SDK call throws, so the friendship gate never blocks a
 * non-LIFF environment. Only a real, successful `liff.getFriendship()` returning
 * `friendFlag: false` gates the user to the Add-Friend screen.
 */
export async function getFriendship(): Promise<Friendship> {
  if (!isLiffConfigured()) return { friendFlag: true }
  try {
    const { friendFlag } = await liff.getFriendship()
    return { friendFlag }
  } catch (error) {
    console.warn('[liff] getFriendship failed; treating as friend:', error)
    return { friendFlag: true }
  }
}

/**
 * The LINE **ID token** for the signed-in user, used as the `Authorization:
 * Bearer <id_token>` credential for the LINE-consumer backend endpoints
 * (`/line-users/status`, `/line-users/register`).
 *
 * Returns `null` (never throws) when LIFF is unconfigured, the user is not
 * logged in, or the SDK returns no token — callers treat `null` as "no real
 * LINE session" and fall back to the local-dev mock path rather than issuing a
 * bearer call that would 401. Keeps `@line/liff` isolated behind this module.
 */
export function getIdToken(): string | null {
  if (!isLiffConfigured()) return null
  try {
    return liff.getIDToken()
  } catch (error) {
    console.warn('[liff] getIDToken failed:', error)
    return null
  }
}

/**
 * Initialise the LIFF SDK and return the signed-in user's profile.
 *
 * Returns `null` (never throws) when:
 * - `VITE_LIFF_ID` is not configured (e.g. plain dev browser), or
 * - the user is not logged in (e.g. external browser outside the LINE client), or
 * - init/getProfile fails for any reason.
 *
 * Callers treat `null` as "anonymous" and fall back to a generic experience.
 */
export async function initLiff(): Promise<LiffProfile | null> {
  const liffId = import.meta.env.VITE_LIFF_ID
  if (!liffId) return null

  try {
    await liff.init({ liffId })
    return await getProfile()
  } catch (error) {
    console.warn('[liff] init failed; continuing anonymously:', error)
    return null
  }
}

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
 * The three ways `liff.init()` can end, kept apart on purpose.
 *
 * - `ready`        — the SDK initialised against a real channel.
 * - `unconfigured` — `VITE_LIFF_ID` is unset. A plain dev browser, not a failure.
 * - `failed`       — configured, but init threw: no network, LINE unreachable, bad id.
 */
export type LiffBoot = 'ready' | 'unconfigured' | 'failed'

/**
 * Initialise the LIFF SDK, **reporting** how it went instead of swallowing it.
 *
 * 🔴 THE THREE OUTCOMES MUST STAY APART, and this replaced an `initLiff()` that collapsed them
 * into `null` (2 ก.ย. 2569; it had no callers left after Client Portal v1 was deleted). The
 * client portal's gate has to tell "there is no LIFF id here" from "LINE could not be reached":
 * the first is a dev browser and lands on the login screen, the second is `line-down` and lands
 * on the error screen with a retry button. One `null` for both makes a network outage look like
 * a misconfigured `.env`, and the user is offered the wrong thing to do about it.
 *
 * ⚠️ It still never throws — the fail-soft contract every other helper in this module keeps.
 * What changed is that the caller is now *told*, rather than left to guess from a `null`.
 */
export async function bootLiff(): Promise<LiffBoot> {
  const liffId = import.meta.env.VITE_LIFF_ID
  if (!liffId) return 'unconfigured'

  try {
    await liff.init({ liffId })
    return 'ready'
  } catch (error) {
    console.warn('[liff] init failed:', error)
    return 'failed'
  }
}

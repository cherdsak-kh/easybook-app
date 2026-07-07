import liff from '@line/liff'

/** Minimal LINE profile shape used by the UI. */
export interface LiffProfile {
  displayName: string
  userId: string
  pictureUrl?: string
}

/**
 * Initialise the LIFF SDK and return the signed-in user's profile.
 *
 * Returns `null` (never throws) when:
 * - `VITE_LIFF_ID` is not configured (e.g. plain dev browser), or
 * - the user is not logged in (e.g. external browser outside the LINE client), or
 * - init/getProfile fails for any reason.
 *
 * Callers treat `null` as "anonymous" and fall back to a generic greeting.
 */
export async function initLiff(): Promise<LiffProfile | null> {
  const liffId = import.meta.env.VITE_LIFF_ID
  if (!liffId) return null

  try {
    await liff.init({ liffId })
    if (!liff.isLoggedIn()) return null
    const profile = await liff.getProfile()
    return {
      displayName: profile.displayName,
      userId: profile.userId,
      pictureUrl: profile.pictureUrl,
    }
  } catch (error) {
    console.warn('[liff] init failed; continuing anonymously:', error)
    return null
  }
}

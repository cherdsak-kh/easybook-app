/**
 * Thai Buddhist-era date/time formatting for back-office audit fields.
 *
 * Built once and EXPORTED so a test can compute its expected string with the same
 * formatter instead of hardcoding "2569" — the runner's ICU data decides the exact
 * glyphs, so a literal assertion is environment-fragile. Mirrors the convention
 * already used by the LINE-users page (`th-TH-u-ca-buddhist`).
 */
const TH_DATE_TIME = new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * Format an ISO timestamp for display. Returns `fallback` for `null`/`undefined`
 * AND for an unparsable string, so a bad value can never render "Invalid Date".
 */
export function formatThaiDateTime(iso: string | null | undefined, fallback: string): string {
  if (!iso) return fallback
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? fallback : TH_DATE_TIME.format(date)
}

/**
 * The password policy, split out of `<PasswordRules>` so that file exports components only.
 * oxlint's `only-export-components` is not style advice: a module that mixes components with
 * plain exports loses Fast Refresh, and the whole page reloads on every edit instead.
 *
 * These rules are the BACKEND's. `POST /auth/system/password` rejects anything that fails
 * them, so a checklist that disagrees walks the operator into a 400 they were told could not
 * happen — keep the two together or delete the checklist.
 */

export interface PasswordRuleState {
  len: boolean
  upper: boolean
  lower: boolean
  digit: boolean
  special: boolean
  diff: boolean
}

/** Minimum length the backend enforces. */
export const PASSWORD_MIN = 8
/** Maximum the DTO accepts — also the field's `maxLength`. */
export const PASSWORD_MAX = 128

/**
 * `special` is "not a letter, not a digit, not whitespace" rather than a fixed list. An
 * explicit list in the UI would understate what the server takes, and a user who tried a
 * character missing from it would wrongly conclude it was rejected.
 *
 * `diff` passes vacuously when there is no current password to differ from — the two
 * password screens differ on exactly that.
 */
export function checkPassword(value: string, current?: string): PasswordRuleState {
  return {
    len: value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX,
    upper: /[A-Z]/.test(value),
    lower: /[a-z]/.test(value),
    digit: /\d/.test(value),
    special: /[^A-Za-z0-9\s]/.test(value),
    diff: current === undefined ? true : value.length > 0 && value !== current,
  }
}

/** Every rule met — what a submit button gates on, alongside the server's own answer. */
export const passwordOk = (s: PasswordRuleState): boolean => Object.values(s).every(Boolean)

/**
 * The fragment each rule contributes to a submit-time error, so the message NAMES what is missing
 * instead of saying "ยังไม่ผ่านเงื่อนไขทั้งหมด". With five rules, a generic sentence makes the
 * operator diff their own password against a checklist by eye — and the error is what focus lands
 * on, so it is the one that has to say something.
 *
 * `diff` has no fragment: it is the only rule that is not about the new password alone, and it
 * carries its own whole sentence (`ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน`).
 *
 * ⚠️ Each fragment matches its `PasswordRules` row and its server-side `@Matches` message. The
 * three must not drift — `ChangePasswordDto` carries one `@Matches` per class for exactly this
 * reason, so a 400 names the same class the checklist is pointing at.
 */
const NEEDED: { key: keyof PasswordRuleState; need: string }[] = [
  { key: 'len', need: `ความยาวอย่างน้อย ${PASSWORD_MIN} ตัวอักษร` },
  { key: 'upper', need: 'ตัวพิมพ์ใหญ่' },
  { key: 'lower', need: 'ตัวพิมพ์เล็ก' },
  { key: 'digit', need: 'ตัวเลข' },
  { key: 'special', need: 'อักขระพิเศษ' },
]

/** Which rules a candidate misses, in checklist order. */
export const missingIn = (s: PasswordRuleState): string[] =>
  NEEDED.filter((r) => !s[r.key]).map((r) => r.need)

/**
 * Thai lists the last item with `และ` and separates the rest with a SPACE, not a comma —
 * `join(', ')` reads as English punctuation dropped into a Thai sentence.
 */
export function joinTh(parts: string[]): string {
  if (parts.length < 2) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(' ')} และ${parts[parts.length - 1]}`
}

/**
 * The whole submit-time verdict for the new-password field, in the prototype's order: length first
 * (the rule most people miss, and the one with its own plain sentence), then the character classes
 * named together, then "must differ" LAST because it is the only rule about the OTHER box.
 *
 * Returns `''` when the value passes. Shared so the forced gate and the voluntary page cannot
 * answer the same failure with two different sentences.
 */
export function newPasswordError(value: string, current: string): string {
  if (!value) return 'โปรดระบุรหัสผ่านใหม่'
  const state = checkPassword(value, current)
  if (value.length < PASSWORD_MIN) return `รหัสผ่านใหม่ต้องยาวอย่างน้อย ${PASSWORD_MIN} ตัวอักษร`
  if (value.length > PASSWORD_MAX) return `รหัสผ่านใหม่ต้องยาวไม่เกิน ${PASSWORD_MAX} ตัวอักษร`
  const missing = missingIn(state)
  if (missing.length) return `รหัสผ่านใหม่ต้องมี${joinTh(missing)}`
  if (!state.diff) return 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน'
  return ''
}

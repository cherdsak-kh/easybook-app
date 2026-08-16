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

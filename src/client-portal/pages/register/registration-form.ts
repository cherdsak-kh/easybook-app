import type { LineUserRegistration } from '@/lib/api-client'

/**
 * The registration form's shape, its rules, and the one list that fixes field order.
 *
 * ── 🔴 FIELD ORDER IS A RULE, NOT A LAYOUT (PO, 26 ส.ค. 2569) ──
 * ชื่อ–สกุล → **ตำแหน่ง** → **กลุ่ม/ฝ่าย** → เบอร์โทรศัพท์. ตำแหน่ง comes BEFORE กลุ่ม/ฝ่าย: it is
 * the Thai civil-service convention and the order the back-office already holds
 * (`RegistrationEditDialog`). `#/pending`'s summary re-states the same four in the same order —
 * a summary that re-orders the fields somebody just filled in makes them re-read it to check
 * nothing moved (prototype 713). {@link SUMMARY_ROWS} is that single list, so the two cannot
 * drift; the form's own JSX is held against it by eye, which is the one join left.
 *
 * ── ⚠️ THE LABEL IS `กลุ่ม/ฝ่าย`, NOT ฝ่าย/แผนก ──
 * A school has both กลุ่ม and ฝ่าย, and the back-office renamed it already. One vocabulary across
 * both portals, or the same column has two names depending on who is looking at it.
 *
 * ── Why the rules live here and not in the component ──
 * They are pure functions over strings, so they are the one part of this screen a spec MAY test
 * (`CONVENTIONS.md` §2 forbids specs for React components, not for functions). Nothing in this
 * file imports React.
 */

/** The four values the form collects, before they become a request body. */
export type RegistrationValues = {
  firstName: string
  lastName: string
  /** The trigger's selected id, as a string — `Combobox` speaks strings, the API wants an int. */
  personnelRoleId: string
  departmentId: string
  /** BARE DIGITS. See {@link fmtPhone} for why the display form is not stored. */
  phone: string
}

export type RegistrationField = keyof RegistrationValues

/** Field → Thai message, for the fields that failed. Absent key = that field is fine. */
export type RegistrationErrors = Partial<Record<RegistrationField, string>>

export const EMPTY_VALUES: RegistrationValues = {
  firstName: '',
  lastName: '',
  personnelRoleId: '',
  departmentId: '',
  phone: '',
}

/** Thai mobile numbers are ten digits. Prototype `PHONE_LEN`. */
export const PHONE_LEN = 10

/**
 * Pre-fill from the record `GET /line-users/status` returned. `null` → an empty form.
 *
 * ⚠️ THE PHONE IS STRIPPED TO DIGITS ON THE WAY IN. The backend's column is deliberately loose
 * (`^[0-9+\-() ]{6,20}…`, so `081-234-5678` is stored exactly as an admin typed it), while this
 * form validates ten bare digits. Handing the stored separators straight to the input would show
 * the user a value their own form then rejects, with nothing on screen explaining why.
 */
export function valuesFrom(registration: LineUserRegistration | null): RegistrationValues {
  if (!registration) return EMPTY_VALUES
  return {
    firstName: registration.firstName,
    lastName: registration.lastName,
    personnelRoleId: String(registration.personnelRoleId),
    departmentId: String(registration.departmentId),
    phone: registration.phone.replace(/\D/g, ''),
  }
}

/**
 * `0812345678` → `081-234-5678`. Anything that is not exactly ten digits is returned untouched.
 *
 * ⚠️ THIS IS A DISPLAY FORM AND IS NEVER STORED OR SENT. The separators exist because a Thai
 * reader checking their own number scans it in three groups; the record keeps the digits, so the
 * one value can be dialled, searched and compared without anybody guessing which shape it is in.
 * The untouched fallback is what makes it safe over an office number an admin typed by hand
 * (`02-123-4567 ต่อ 101`) — those come back as they were written rather than re-grouped wrongly.
 */
export function fmtPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length !== PHONE_LEN || digits !== phone) return phone
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
}

/**
 * Validate the whole form and return every message at once.
 *
 * ⚠️ ALL FOUR CHECKED, NOT SHORT-CIRCUITED. Someone who left two fields blank should be told
 * about both on the first press, not made to submit twice. The caller focuses the first bad one
 * in DOM order, which is why {@link ORDER} exists.
 *
 * ── ⚠️ THE NAME RULE IS "NO DIGITS", NOT "THAI ONLY" ──
 * The prototype checks `/\d/` (2698) and that is what is ported. A Thai-script-only test would
 * reject `Anna` and `ณัฐ Smith`, both of which are real names on a real staff list; the failure
 * it is actually guarding against is a phone number or an ID typed into the name box.
 *
 * ── The three phone tiers are coarse → fine, and the MESSAGE MUST MATCH THE TIER THAT FAILED ──
 * Somebody who typed `081-234-5678` has to hear "digits only", not "must start with 06/08/09",
 * which is advice that does not solve their problem.
 *
 * ⚠️ Landlines are refused ON PURPOSE (prototype 2709): notifications go out over the LINE OA,
 * so the number on file has to be a mobile. If the PO ever wants office numbers, the last regex
 * here is the only line that changes.
 */
export function validate(values: RegistrationValues): RegistrationErrors {
  const errors: RegistrationErrors = {}
  const first = values.firstName.trim()
  const last = values.lastName.trim()
  const phone = values.phone.trim()

  if (!first) errors.firstName = 'โปรดระบุชื่อจริง'
  else if (/\d/.test(first)) errors.firstName = 'ชื่อจริงจะต้องไม่มีตัวเลข'

  if (!last) errors.lastName = 'โปรดระบุนามสกุล'
  else if (/\d/.test(last)) errors.lastName = 'นามสกุลจะต้องไม่มีตัวเลข'

  if (!values.personnelRoleId) errors.personnelRoleId = 'โปรดเลือกตำแหน่ง'
  if (!values.departmentId) errors.departmentId = 'โปรดเลือกกลุ่ม/ฝ่าย'

  if (!phone) errors.phone = 'โปรดระบุเบอร์โทรศัพท์'
  else if (!/^[0-9]+$/.test(phone)) errors.phone = 'เบอร์โทรศัพท์ต้องเป็นตัวเลขเท่านั้น'
  else if (phone.length !== PHONE_LEN) errors.phone = `เบอร์โทรศัพท์ต้องมี ${PHONE_LEN} หลัก`
  else if (!/^0[689]\d{8}$/.test(phone))
    errors.phone = 'เบอร์โทรศัพท์ต้องขึ้นต้นด้วย 06 08 หรือ 09'

  return errors
}

/**
 * The fields in DOM order, for "focus the FIRST bad one".
 *
 * ⚠️ `firstName` and `lastName` share a row on `sm:` and up, so DOM order and reading order are
 * the same only because the grid fills row-wise. Nothing here should be sorted.
 */
export const ORDER: readonly RegistrationField[] = [
  'firstName',
  'lastName',
  'personnelRoleId',
  'departmentId',
  'phone',
]

/** The first field with a message, or `null`. */
export function firstInvalid(errors: RegistrationErrors): RegistrationField | null {
  return ORDER.find((field) => errors[field]) ?? null
}

/**
 * `#/pending`'s summary rows (prototype 2940) — the same four fields, in the same order, resolved
 * to names.
 *
 * ⚠️ IT READS THE **RESOLVED** `department` / `personnelRole` STRINGS, never the ids. Those are
 * what the response carries them for, and printing an id would show the reader a number that
 * means nothing to them.
 */
export function summaryRows(
  registration: LineUserRegistration,
): readonly { label: string; value: string }[] {
  return [
    { label: 'ชื่อ–สกุล', value: `${registration.firstName} ${registration.lastName}` },
    { label: 'ตำแหน่ง', value: registration.personnelRole },
    { label: 'กลุ่ม/ฝ่าย', value: registration.department },
    { label: 'เบอร์โทรศัพท์', value: fmtPhone(registration.phone) },
  ]
}

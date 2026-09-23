import { devStatus, isDevGate } from '@/client-portal/hooks/useLiffGate'
import {
  ApiError,
  getRegistrationOptions,
  registerLineUser,
  updateLineUserRegistration,
} from '@/lib/api-client'
import type { LineUserStatus, RegistrationOptions } from '@/lib/api-client'
import { getIdToken } from '@/lib/liff'

/**
 * The three calls `#/register` makes, with the bearer token attached and the failure translated.
 *
 * ── ⚠️ WHY THIS SITS BETWEEN THE SCREEN AND `api-client.ts` ──
 * Two things have to happen on every call and neither belongs in a component: the LINE ID token
 * has to be fetched (the client-portal endpoints are bearer-authenticated, not cookie-session
 * like the whole back-office), and the DEV case override has to be answered from a fixture
 * because under it there is no token to send. Doing that inline would put a `import.meta.env.DEV`
 * branch in the middle of a submit handler, and a branch that is easy to copy is a branch that
 * gets copied to a screen where it is not safe.
 *
 * ── 🔴 THE DEV BRANCH INHERITS ALL THREE OF THE GATE'S LOCKS, IT DOES NOT ADD A FOURTH DOOR ──
 * `isDevGate()` is `import.meta.env.DEV` **and** `!isLiffConfigured()` **and** an explicit
 * `?gate=` in the URL, decided once in `useLiffGate.ts`. It is deliberately NOT re-derived here:
 * a second copy of a security condition is a second thing that can be relaxed by accident, and
 * the one that would be relaxed is the one keeping a fixture out of a real session.
 *
 * ⚠️ The fixture path proves the SCREENS, never the CONTRACT. Nothing below shows that the real
 * backend accepts this body — that is the Phase 3 exit gate's "against the real API", which needs
 * a tunnelled LINE session and cannot be reached from a desktop browser.
 */

/** Milliseconds the fixture path waits, so the disabled/บันทึก… state is a real frame. */
const DEV_LATENCY_MS = 350

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * The fixture option lists. Prototype `ROLES` / `DEPTS` (2632), verbatim and in the same order —
 * the API returns them already sorted, so this must not re-sort them either.
 */
const DEV_OPTIONS: RegistrationOptions = {
  personnelRoles: [
    { id: 1, name: 'ครูผู้สอน' },
    { id: 2, name: 'ครูพี่เลี้ยง' },
    { id: 3, name: 'เจ้าหน้าที่ธุรการ' },
    { id: 4, name: 'นักการภารโรง' },
    { id: 5, name: 'รองผู้อำนวยการ' },
  ],
  departments: [
    { id: 1, name: 'กลุ่มบริหารงานวิชาการ' },
    { id: 2, name: 'กลุ่มบริหารงานงบประมาณ' },
    { id: 3, name: 'กลุ่มบริหารงานบุคคล' },
    { id: 4, name: 'กลุ่มบริหารงานทั่วไป' },
    { id: 5, name: 'ฝ่ายปฐมวัย' },
  ],
}

/**
 * The registration body, with the two option ids already coerced to integers.
 *
 * ⚠️ `Number()`, not `parseInt`: the ids come from `Combobox`, whose values are the stringified
 * ids this module handed it, so anything that is not a clean integer is a bug upstream rather
 * than something to salvage a prefix out of.
 */
export type RegistrationBody = {
  firstName: string
  lastName: string
  phone: string
  personnelRoleId: number
  departmentId: number
}

/**
 * 🔴 EVERY MESSAGE THIS MODULE PRODUCES IS THAI, AND THE SERVER'S IS NEVER SHOWN (`I18N-ERR-1`).
 * The backend answers in English by design — `"phone must be digits and separators, optionally
 * followed by ต่อ or ext…"` is written for the contract, not for a teacher on a phone. So the
 * status code is mapped to a sentence written here, and the original goes to the console for
 * whoever is debugging.
 *
 * The four cases are genuinely different instructions, which is the only reason there are four:
 * a dead session means reopen the app, a 400 means fix the form, a 403 means the record moved
 * underneath them, and anything else means try again.
 */
export function messageFor(error: unknown): string {
  const status = error instanceof ApiError ? error.status : 0
  if (status === 401) return 'เซสชัน LINE หมดอายุ กรุณาปิดและเปิดแอปพลิเคชันใหม่อีกครั้ง'
  if (status === 400) return 'ข้อมูลที่กรอกไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง'
  if (status === 403) return 'สถานะการลงทะเบียนของคุณเปลี่ยนแปลงแล้ว กรุณาเริ่มการตรวจสอบใหม่'
  return 'ส่งข้อมูลไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อและลองใหม่อีกครั้ง'
}

/**
 * The ID token, or a throw that {@link messageFor} turns into the session-expired sentence.
 *
 * ⚠️ A MISSING TOKEN IS A 401, NOT A SILENT NO-OP. It is the same condition the gate calls `obs2`,
 * and a submit button that quietly does nothing is the worst way to report it.
 */
function bearerToken(): string {
  const token = getIdToken()
  if (!token) throw new ApiError(401, 'No LINE ID token available.')
  return token
}

/** Both combobox lists, in one call. Cached server-side under `opt:liff`. */
export async function loadOptions(): Promise<RegistrationOptions> {
  if (isDevGate()) {
    await sleep(DEV_LATENCY_MS)
    return DEV_OPTIONS
  }
  return getRegistrationOptions(bearerToken())
}

/**
 * Submit the form and return the caller's refreshed status.
 *
 * ── 🔴 ONE FUNCTION, TWO VERBS, AND THE CALLER DOES NOT CHOOSE ──
 * `POST /line-users/register` is the first submit; `PATCH /line-users/registration` is every
 * later one, and `PENDING` and `REJECTED` use the SAME endpoint and the SAME form — resubmitting
 * flips a returned record back to `PENDING` and clears the reason server-side
 * (`TRANSPORT.md` §3.1). The verb therefore follows from ONE fact, whether a registration row
 * already exists, so it is derived here rather than passed in: a caller that could pass the wrong
 * one would `POST` a duplicate for somebody who already has a record.
 *
 * ⚠️ The RESPONSE decides the next screen, not this function. Both verbs answer with a full
 * `LineUserStatusResponseDto`; the caller hands it to `applyStatus` and follows `LANDING`.
 */
export async function submitRegistration(
  body: RegistrationBody,
  hasExistingRegistration: boolean,
): Promise<LineUserStatus> {
  if (isDevGate()) {
    await sleep(DEV_LATENCY_MS)
    /* The fixture backend's whole behaviour, and it is the real one's too: a submit lands on
       PENDING, from UNREGISTERED and from REJECTED alike, and the reason is cleared. */
    const base = devStatus()
    return {
      access: 'PENDING',
      rejectionReason: null,
      registration: {
        id: base?.registration?.id ?? 'dev-registration',
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone,
        personnelRoleId: body.personnelRoleId,
        personnelRole:
          DEV_OPTIONS.personnelRoles.find((o) => o.id === body.personnelRoleId)?.name ?? '',
        departmentId: body.departmentId,
        department: DEV_OPTIONS.departments.find((o) => o.id === body.departmentId)?.name ?? '',
        createdAt: base?.registration?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }
  }

  const token = bearerToken()
  return hasExistingRegistration
    ? updateLineUserRegistration(body, token)
    : registerLineUser(body, token)
}

import type { LIconName } from '@/client-portal/icons/licon'
import type { components } from '@/lib/api-types'

/**
 * `#/issues` — the rules, the copy table and the draft store. Ported from
 * `client_portal_prototype.html` 5985–6237 (`IS_TYPES`, `isMsgs`, `isAddFiles`, `isReset`).
 *
 * ── 🔴 EVERYTHING THAT DIFFERS BETWEEN THE TWO TYPES LIVES IN `IS_TYPES` AND NOWHERE ELSE ──
 * The prototype's own rule, restated because it is the one thing this screen has to keep:
 * *"เพิ่มประเภทที่สามในอนาคตจึงเป็นการเติมแถว ไม่ใช่การไล่หา `if (type === …)` ทั่วไฟล์"* — a third
 * type is ONE NEW ROW here, never a new branch in `IssuesPage`. The page reads the row and paints;
 * it never asks which type it is holding. That is `AC-7`, and it is checkable by grepping the page
 * for the word `feedback` — it appears only as a key into this table.
 *
 * ── The React port adds exactly one column: `apiType` ──
 * `02_design_log.md` §7.1 / `D-A7`: the wire speaks the Prisma enum (`ISSUE` / `FEEDBACK`,
 * uppercase) while the prototype's keys are lowercase. The mapping is a FIELD OF THE ROW rather
 * than a second lookup table, so the "one new row" property survives the contract.
 *
 * ── ⚠️ THERE IS NO `category`, AND ADDING ONE IS A RULING TO RE-OPEN, NOT A GAP TO FILL ──
 * `D-4` (plan §4): the mandatory category chips were removed on 17 ก.ย. 2569 after user feedback —
 * *"การจัดหมวดเป็นงานของเจ้าหน้าที่ฝั่ง admin ไม่ใช่ของคนที่มาแจ้ง"*. Not as a column, not as a DTO
 * field, not as a UI control.
 *
 * ── These are pure functions and MAY be unit-tested ──
 * `CONVENTIONS.md` §2 forbids specs for React COMPONENTS, which is why `IssuesPage` has none. The
 * validators and the file screen below have return values and no DOM; a spec for one of them is
 * "not forbidden, not required".
 */

// ---------------------------------------------------------------------------
// The copy table.
// ---------------------------------------------------------------------------

/** The two prototype keys, verbatim. A third type is a third key here and a row below. */
export type IssueTypeKey = 'issue' | 'feedback'

/** The wire enum, from the generated spec — never a hand-written string union. */
export type FeedbackApiType = components['schemas']['FeedbackType']

export type IssueTypeRow = {
  /** The line under the switcher. */
  note: string
  /** The venue field's label — the one label that changes meaning with the type. */
  venueLabel: string
  /** `<input>` placeholder. */
  subject: string
  /** `<textarea>` placeholder. */
  desc: string
  /** The word for this type in the success dialog's `ประเภท` row. */
  kind: string
  /** The switcher button's own label. */
  label: string
  /** The switcher button's glyph. */
  icon: LIconName
  /**
   * The reference-code prefix, `ISS` / `FDB`.
   *
   * ⚠️ IT IS NOT USED TO BUILD A CODE — `AC-37` says the client never generates or guesses one and
   * prints `res.code` instead. It is kept because it is the prototype's row and because it
   * documents which prefix a given type produces, which is what a reader of this table wants to
   * know when somebody phones in quoting `FDB-…`.
   */
  prefix: string
  /** `D-A7` — what crosses the wire for this row. */
  apiType: FeedbackApiType
}

export const IS_TYPES: Readonly<Record<IssueTypeKey, IssueTypeRow>> = {
  issue: {
    note: 'อุปกรณ์ชำรุด ความสะอาด หรือระบบแอปใช้งานไม่ได้',
    venueLabel: 'สถานที่ที่พบปัญหา',
    subject: 'ระบุหัวข้อปัญหาอย่างสั้น',
    desc: 'อธิบายสิ่งที่พบ — จุดที่เกิด (เช่น แถวที่นั่ง / มุมห้อง) เกิดขึ้นเมื่อไร และส่งผลต่อการใช้งานอย่างไร',
    kind: 'แจ้งปัญหาการใช้งาน',
    label: 'แจ้งปัญหา',
    icon: 'circleAlert',
    prefix: 'ISS',
    apiType: 'ISSUE',
  },
  feedback: {
    note: 'ความคิดเห็นเพื่อปรับปรุงบริการ สิ่งอำนวยความสะดวก หรือระเบียบการใช้งาน',
    venueLabel: 'สถานที่ที่เกี่ยวข้อง',
    subject: 'สรุปข้อเสนอแนะอย่างสั้น',
    desc: 'เล่าสิ่งที่อยากให้ปรับปรุง และเหตุผลหรือประโยชน์ที่คาดว่าจะได้รับ',
    kind: 'ข้อเสนอแนะ',
    label: 'ข้อเสนอแนะ',
    icon: 'lightbulb',
    /* ⚠️ `FDB`, NOT `ISS` — the reference code is what somebody reads down a phone line, and the
       prefix says whether the call is about breakage or about a suggestion before anyone opens
       anything. */
    prefix: 'FDB',
    apiType: 'FEEDBACK',
  },
}

/** Render order for the switcher. `Object.keys` order is not a contract; this is. */
export const IS_TYPE_ORDER: readonly IssueTypeKey[] = ['issue', 'feedback']

// ---------------------------------------------------------------------------
// Limits. Every one of them is the server's, restated on this side.
// ---------------------------------------------------------------------------

/** `CreateFeedbackDto.description` — 1–500 **after trimming** (`E-9`: 500 passes, 501 does not). */
export const IS_MAX_DESC = 500
/** `CreateFeedbackDto.subject` — enforced here as `maxlength`, so 101 is unreachable. */
export const IS_MAX_SUBJECT = 100
/** `photos[]` — `@ArrayMaxSize(3)` on the server. */
export const IS_MAX_PHOTOS = 3
/**
 * 5 MiB.
 *
 * ⚠️ THE COMPARISON IS `>`, NEVER `>=`. `02_design_log.md` §4.2 sets multer's limit to
 * `MAX + 1` precisely so a file of exactly 5 MiB is ACCEPTED; a client that rejected it would
 * refuse something the server would have taken, and the message would name a ceiling that is not
 * the real one.
 */
export const IS_MAX_BYTES = 5 * 1024 * 1024

/**
 * The only two types the upload route stores (`AC-39`, `D-A8`).
 *
 * ⚠️ NARROWER THAN THE PROTOTYPE'S `/^image\//`, and narrower than the avatar route's allowlist,
 * which also takes webp. The server refuses webp here, so accepting it client-side would mean
 * uploading a file that is guaranteed to come back a 400 — the screen would be offering something
 * no path can deliver.
 */
export const IS_PHOTO_TYPES: readonly string[] = ['image/jpeg', 'image/png']

/**
 * The `<select>` value that means "no venue".
 *
 * 🔴 IT IS NOT AN ID AND MUST NEVER REACH THE WIRE. `venueId: null` is how `ปัญหาทั่วไป` persists
 * (plan §5 B1); sending the literal string would be a 400 naming an unknown venue.
 */
export const IS_GENERAL_VENUE = 'general'

/** The first option's label, and the `สถานที่` row the success dialog prints for it. */
export const IS_GENERAL_VENUE_LABEL = 'ปัญหาทั่วไป / ไม่ระบุสถานที่'

// ---------------------------------------------------------------------------
// Validation.
// ---------------------------------------------------------------------------

export type IssueFieldKey = 'subject' | 'desc'

/** `''` = valid. The prototype's `isMsgs()`. */
export type IssueMessages = Record<IssueFieldKey, string>

/**
 * The two field rules, in one place, evaluated on TRIMMED values.
 *
 * 🔴 TRIM FIRST, THEN COUNT (`E-9`). The server does the same (`@Transform(trim)` before
 * `@MaxLength`), and the two boundaries have to agree at exactly 500/501 or a submit the client
 * allowed comes back a 400 that names a length the counter never showed.
 *
 * ⚠️ OVER-LENGTH IS AN ERROR, NOT A TRUNCATION. The textarea deliberately carries no `maxlength`
 * (`AC-12`): a hard cap silently drops the tail of pasted text and the writer never learns which
 * part went missing.
 */
export function issueMessages(subject: string, description: string): IssueMessages {
  const s = subject.trim()
  const d = description.trim()
  return {
    subject: s ? '' : 'กรุณาระบุหัวข้อ',
    desc: !d
      ? 'กรุณาระบุรายละเอียด'
      : d.length > IS_MAX_DESC
        ? `ยาวเกินไป — ไม่เกิน ${IS_MAX_DESC} ตัวอักษร (ตอนนี้ ${d.length})`
        : '',
  }
}

/** True when neither field has a message. */
export function issueIsValid(messages: IssueMessages): boolean {
  return !messages.subject && !messages.desc
}

/** `412 KB` under a megabyte, `1.4 MB` above it. The prototype's size line, unchanged. */
export function fmtPhotoSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export type ScreenedFiles = {
  /** Files that passed every client-side rule, in pick order. */
  accepted: File[]
  /** De-duplicated Thai reasons, ready to `join(' · ')`. */
  skipped: string[]
}

/**
 * Decide which of a selection may be attached (`AC-20`).
 *
 * ⚠️ A REJECTED FILE DOES NOT POISON THE SELECTION. Pick four files where one is a PDF and the
 * other three are photos: the three attach and one sentence explains the fourth. Refusing the whole
 * batch is the behaviour people read as "the uploader is broken".
 *
 * ⚠️ REASONS ARE DE-DUPLICATED. Five files over the limit produce ONE `แนบได้สูงสุด 3 รูป`, not
 * five identical lines — the prototype's `skipped.filter(indexOf === i)`.
 *
 * ⚠️ THE TYPE CHECK RUNS BEFORE THE SIZE CHECK, and the order is the prototype's: a 9 MB PDF is
 * "not an image", which is the useful sentence; telling somebody their PDF is too large invites
 * them to compress it.
 */
export function screenFiles(files: ArrayLike<File> | null, attached: number): ScreenedFiles {
  const accepted: File[] = []
  const skipped: string[] = []
  let room = IS_MAX_PHOTOS - attached

  for (const file of Array.from(files ?? [])) {
    if (!IS_PHOTO_TYPES.includes(file.type)) {
      skipped.push(`${file.name} ไม่ใช่ไฟล์รูปภาพ`)
      continue
    }
    if (file.size > IS_MAX_BYTES) {
      skipped.push(`${file.name} มีขนาดเกิน 5 MB`)
      continue
    }
    if (room <= 0) {
      skipped.push(`แนบได้สูงสุด ${IS_MAX_PHOTOS} รูป`)
      continue
    }
    room -= 1
    accepted.push(file)
  }

  return { accepted, skipped: skipped.filter((s, i) => skipped.indexOf(s) === i) }
}

// ---------------------------------------------------------------------------
// The draft — module-scoped, because `AC-32` says the form is not cleared on entering.
// ---------------------------------------------------------------------------

/**
 * One attached photo.
 *
 * 🔴 `uploadedUrl === null` MEANS "STILL UPLOADING", AND IT IS THE ONLY IN-FLIGHT STATE. There is
 * deliberately no `failed` member: per `E-2` a photo whose upload fails **never enters this list**
 * — it is removed and a message is shown instead — so a row on screen is always either uploading
 * or stored. That invariant is what makes `E-3`'s rule ("block submit while any upload is in
 * flight") expressible as `photos.some((p) => p.uploadedUrl === null)`.
 */
export type IssuePhoto = {
  /** List identity. A counter, not the filename — two files may share a name. */
  id: string
  name: string
  size: number
  /** `URL.createObjectURL`. Revoked the moment the row leaves the list, never before. */
  previewUrl: string
  /** The stored URL from `POST /line-users/feedback/photos`. `null` while in flight. */
  uploadedUrl: string | null
}

export type IssueDraft = {
  type: IssueTypeKey
  /** `IS_GENERAL_VENUE` or a venue id. */
  venue: string
  subject: string
  description: string
  photos: IssuePhoto[]
  /** Which fields have been blurred. Errors appear only for these (`AC-11`). */
  touched: Record<IssueFieldKey, boolean>
  /**
   * The last attachment refusal — a skip reason from {@link screenFiles}, or an `E-2` upload
   * failure. `null` = nothing to say.
   *
   * ⚠️ IT LIVES IN THE DRAFT RATHER THAN IN COMPONENT STATE, and that is not tidiness. An upload
   * started here can fail AFTER the user has navigated away (`E-2` removes the row from this same
   * draft); component state would be gone by then, so they would come back to a photo that had
   * silently vanished with no sentence explaining it. The prototype gets the same property for
   * free — its error `<span>` is in a screen that never leaves the DOM.
   */
  photoError: string | null
}

function emptyDraft(): IssueDraft {
  return {
    type: 'issue',
    venue: IS_GENERAL_VENUE,
    subject: '',
    description: '',
    photos: [],
    touched: { subject: false, desc: false },
    photoError: null,
  }
}

/**
 * 🔴 WHY THIS LIVES AT MODULE SCOPE AND NOT IN `useState` ──
 * `AC-32` / the prototype: *"ฟอร์มไม่ถูกล้างตอนเข้าจอ — กดไปอ่านระเบียบแล้วย้อนกลับมาต้องได้สิ่งที่
 * พิมพ์ไว้คืน"*. The prototype gets that for free because its screens are `hidden` sections that
 * never leave the DOM; a router UNMOUNTS `IssuesPage`, so component state would be destroyed by
 * the very navigation the rule is about — walking out to read `#/rules` and back.
 *
 * ⚠️ IT ALSO OUTLIVES THE COMPONENT ON PURPOSE FOR THE UPLOADS. A photo picked and then navigated
 * away from finishes uploading into this object (`AC-23`), so coming back shows it attached rather
 * than stuck on a spinner that no longer has anything spinning behind it.
 *
 * ⚠️ IT IS A SESSION-LIFETIME OBJECT, NOT STORAGE. A full reload rebuilds the module and the draft
 * is gone — which is correct: the object URLs it holds are revoked by that same reload.
 */
let DRAFT: IssueDraft = emptyDraft()

let photoSeq = 0

/** The live draft. Callers must treat it as immutable and go through {@link updateDraft}. */
export function readDraft(): IssueDraft {
  return DRAFT
}

/**
 * Merge into the draft and return the new value.
 *
 * ⚠️ THE FUNCTION FORM READS THE **LIVE** DRAFT, not a closed-over copy. Photo uploads settle out
 * of order and minutes apart; `updateDraft((prev) => …)` is the only form that is safe there.
 */
export function updateDraft(
  patch: Partial<IssueDraft> | ((prev: IssueDraft) => Partial<IssueDraft>),
): IssueDraft {
  DRAFT = { ...DRAFT, ...(typeof patch === 'function' ? patch(DRAFT) : patch) }
  return DRAFT
}

/** A new attachment row, pre-upload. */
export function newPhoto(file: File): IssuePhoto {
  photoSeq += 1
  return {
    id: `is-photo-${photoSeq}`,
    name: file.name,
    size: file.size,
    previewUrl: URL.createObjectURL(file),
    uploadedUrl: null,
  }
}

/**
 * Back to an empty form, revoking every preview URL on the way out.
 *
 * 🔴 CALLED ONLY AFTER A SUCCESSFUL SUBMIT, AND **BEFORE** THE DIALOG OPENS (`AC-28`). Closing the
 * dialog must reveal an empty form, never a re-submittable copy of what was just sent — which is
 * also why the dialog renders from the server's response rather than from the fields.
 *
 * ⚠️ A FAILED SUBMIT MUST NOT CALL THIS (`E-4`). The user's text and their already-uploaded photo
 * keys survive, so retrying costs one tap.
 */
export function resetDraft(): IssueDraft {
  for (const photo of DRAFT.photos) URL.revokeObjectURL(photo.previewUrl)
  DRAFT = emptyDraft()
  return DRAFT
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  isVenueRefusal,
  messageFor,
  photoMessageFor,
  submitFeedback,
  uploadFeedbackPhoto,
  VENUE_REFUSED_MESSAGE,
  type CreateFeedback,
  type Feedback,
} from './issues-api'
import {
  fmtPhotoSize,
  IS_GENERAL_VENUE,
  IS_GENERAL_VENUE_LABEL,
  IS_MAX_DESC,
  IS_MAX_PHOTOS,
  IS_MAX_SUBJECT,
  IS_TYPE_ORDER,
  IS_TYPES,
  issueIsValid,
  issueMessages,
  newPhoto,
  readDraft,
  resetDraft,
  screenFiles,
  updateDraft,
  type IssueDraft,
  type IssuePhoto,
  type IssueTypeKey,
} from './issues-form'
import { Skeleton } from '@/client-portal/components/feedback/Skeleton'
import { ScreenHeader, SCREEN_WIDTH_NARROW } from '@/client-portal/components/ui/ScreenHeader'
import { useGate } from '@/client-portal/hooks/gate-context'
import { LIcon } from '@/client-portal/icons/LucideIcon'
import { listVenues } from '@/client-portal/pages/venues/venues-api'
import type { Venue } from '@/lib/api-client'
import { getProfile } from '@/lib/liff'

/**
 * `#/issues` — แจ้งปัญหา / ข้อเสนอแนะ. Prototype markup 1732–1913, behaviour 5985–6237.
 *
 * Closes `Q-C5`: the screen was an `UnderConstruction` placeholder because the contract would have
 * had to be guessed. It is not guessed any more — it is derived from a drawn screen and from
 * `02_design_log.md`'s two endpoints.
 *
 * ── 🔴 NOTHING IN THIS FILE ASKS WHICH TYPE IT IS HOLDING ──
 * `AC-7`. Every difference between แจ้งปัญหา and ข้อเสนอแนะ — the note, the venue label, both
 * placeholders, the switcher's own label and glyph, the word in the success summary, and the wire
 * enum — is a COLUMN of `IS_TYPES[type]` in `issues-form.ts`. Grep this file for `feedback`: it
 * appears as a key into that table and nowhere else. A third type is one new row.
 *
 * ── ⚠️ THE `<section>` CARRIES NO `pad-nav`, AND THE PROTOTYPE'S DOES ──
 * Deliberate, and the same correction `SettingsSubScreen` documents: `LiffShell` is the SINGLE
 * AUTHORITY for dock clearance (`fix/20260909_1715`) and applies `.pad-nav` on the very condition
 * it draws the dock on. A copy here measures 0 px today — `min-h-dvh` plus border-box absorbs the
 * section's own padding while content is short — and starts costing 112–146 px the moment this
 * form is long enough to scroll, which it is as soon as three photos are attached.
 *
 * ── ⚠️ THE WIDTH LADDER STOPS AT `sm:max-w-2xl`, UNLIKE EVERY LIST SCREEN ──
 * `SCREEN_WIDTH_NARROW`, on the header AND the content. The prototype states the reason
 * (1728–1730): a long-form text screen at `lg:max-w-5xl` turns the description into a thin band.
 *
 * ── ⚠️ THE FORM IS NOT CLEARED ON ENTERING THE SCREEN (`AC-32`) ──
 * The draft lives at module scope in `issues-form.ts`; see the note there for why component state
 * cannot express this rule under a router. It is cleared only by a successful submit, and then
 * BEFORE the dialog opens (`AC-28`).
 *
 * ── ⚠️ THE SUCCESS DIALOG IS CLOSED EXPLICITLY, NEVER BY `<form method="dialog">` ──
 * React 19 prevents that form's default (measured on `#/register`, 2 ก.ย. 2569 — the submit event
 * fires with `defaultPrevented === true` and the dialog stays open). Both exits and the backdrop
 * call `close()`, which fires the dialog's own `close` event — the single point where the
 * confirmation is dropped.
 */
export function IssuesPage() {
  const { status } = useGate()
  const registration = status?.registration ?? null

  /* The draft is the module's; this state is a mirror kept in step by `update`. */
  const [draft, setDraft] = useState<IssueDraft>(readDraft)

  /** `null` = still loading. `[]` = loaded empty, or failed (`E-7`) — the form stays submittable. */
  const [venues, setVenues] = useState<Venue[] | null>(null)
  const [venuesFailed, setVenuesFailed] = useState(false)
  const [venueError, setVenueError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [picture, setPicture] = useState<string | null>(null)
  /** The server's answer, and the only thing the dialog renders (`AC-28`, `AC-37`). */
  const [sent, setSent] = useState<Feedback | null>(null)

  const subjectRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  /** Set by the remove handler; consumed after the re-render that brings the dropzone back. */
  const refocusFile = useRef(false)
  /**
   * 🔴 THE GUARD BEHIND `AC-31`. A submit or an upload outlives this component — the user can tap
   * send and then press LIFF's back button. The module draft must still be updated (that is how a
   * photo picked and navigated away from still arrives), but nothing may be PAINTED: a success
   * dialog opening over `#/settings` reads as a bug in that screen.
   */
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  /** Write the module draft first, then mirror it — never the other way round. */
  const update = useCallback(
    (patch: Partial<IssueDraft> | ((prev: IssueDraft) => Partial<IssueDraft>)) => {
      const next = updateDraft(patch)
      if (alive.current) setDraft(next)
      return next
    },
    [],
  )

  // ── Venue options ────────────────────────────────────────────────────────────────────────────
  /**
   * The select's options, and `E-5`'s refresh.
   *
   * ⚠️ ONE PAGE OF 100, NOT A PAGING LOOP. `limit` is capped at 100 server-side and the screen this
   * is drawn for has ten venues; a loop would be machinery for a school that does not exist. If one
   * ever does, this is the line that changes and nothing else.
   *
   * ⚠️ SORTED BY THAI `localeCompare` HERE, ON PURPOSE, even though `#/venues` is forbidden from
   * re-sorting the server's order. That rule is about a PAGINATED list, where a client sort makes
   * appended pages reshuffle what the reader already scrolled past. This is a complete, unpaginated
   * `<select>`, and the prototype sorts it by name (`byName`) because `isOpen DESC` first is
   * meaningless in a menu where a closed venue is exactly the one being reported.
   *
   * ⚠️ A FAILURE IS `[]`, NOT AN ERROR SCREEN (`E-7`). The venue is optional; losing the list must
   * not cost the user the report they came to file.
   */
  const loadVenues = useCallback(async () => {
    try {
      const page = await listVenues({ limit: 100 })
      if (!alive.current) return
      const sorted = [...page.data].sort((a, b) => a.name.localeCompare(b.name, 'th'))
      setVenues(sorted)
      setVenuesFailed(false)
      /* The held id may have just been soft-deleted out from under the form. Falling back is the
         prototype's `paintIsVenues` behaviour — and it is not the "silent drop" `E-5` forbids,
         because the refusal message is on screen beside it. */
      const held = readDraft().venue
      if (held !== IS_GENERAL_VENUE && !sorted.some((v) => v.id === held)) {
        update({ venue: IS_GENERAL_VENUE })
      }
    } catch {
      if (!alive.current) return
      setVenues([])
      setVenuesFailed(true)
    }
  }, [update])

  useEffect(() => {
    void loadVenues()
  }, [loadVenues])

  /* The reporter's LINE picture, exactly as `#/settings` fetches it — the prototype says this card
     uses the same avatar as the profile card. `getProfile()` never throws and answers `null` in a
     plain dev browser, so initials stay the honest fallback rather than a failure placeholder. */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const profile = await getProfile()
      if (!cancelled && profile?.pictureUrl) setPicture(profile.pictureUrl)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ── Photos ───────────────────────────────────────────────────────────────────────────────────
  /**
   * Upload one accepted file and fold the result into the row that is already on screen (`AC-23`).
   *
   * 🔴 `E-2` — A FAILED UPLOAD LEAVES NO ROW BEHIND. The entry is removed and its object URL
   * revoked, so `photos[]` can never carry a key for something the server does not have, and the
   * list can never show a photo that will not be submitted.
   */
  const upload = useCallback(
    async (photo: IssuePhoto, file: File) => {
      try {
        const url = await uploadFeedbackPhoto(file)
        update((prev) => ({
          photos: prev.photos.map((p) => (p.id === photo.id ? { ...p, uploadedUrl: url } : p)),
        }))
      } catch (error) {
        /* Removed while it was in flight? Then there is nothing to undo and nothing to report. */
        if (!readDraft().photos.some((p) => p.id === photo.id)) return
        URL.revokeObjectURL(photo.previewUrl)
        update((prev) => ({
          photos: prev.photos.filter((p) => p.id !== photo.id),
          photoError: photoMessageFor(error, photo.name),
        }))
      }
    },
    [update],
  )

  const addFiles = useCallback(
    (files: FileList | null) => {
      const { accepted, skipped } = screenFiles(files, readDraft().photos.length)
      update({ photoError: skipped.length ? skipped.join(' · ') : null })
      for (const file of accepted) {
        const photo = newPhoto(file)
        update((prev) => ({ photos: [...prev.photos, photo] }))
        void upload(photo, file)
      }
    },
    [update, upload],
  )

  const removePhoto = useCallback(
    (photo: IssuePhoto) => {
      URL.revokeObjectURL(photo.previewUrl)
      update((prev) => ({
        photos: prev.photos.filter((p) => p.id !== photo.id),
        /* A "แนบได้สูงสุด 3 รูป" left standing after one has been removed is a warning that is no
           longer true. The prototype clears it here for the same reason. */
        photoError: null,
      }))
      refocusFile.current = true
    },
    [update],
  )

  /* `AC-22` — focus goes back to the file input, but only once the dropzone is rendered again
     (at three photos it is not in the DOM at all, which is what `AC-19` asks for). */
  useEffect(() => {
    if (!refocusFile.current) return
    refocusFile.current = false
    fileRef.current?.focus()
  }, [draft.photos])

  // ── Submit ───────────────────────────────────────────────────────────────────────────────────
  const type = IS_TYPES[draft.type]
  const messages = issueMessages(draft.subject, draft.description)
  const valid = issueIsValid(messages)
  const descLength = draft.description.trim().length
  const overLength = descLength > IS_MAX_DESC
  /** `E-3` — settled by `02_design_log.md` §7.2: **block the submit**, never drop a visible photo. */
  const uploading = draft.photos.some((p) => p.uploadedUrl === null)

  /**
   * ⚠️ THE OVER-LENGTH MESSAGE IS NOT GATED ON `touched`, AND THE EMPTY-FIELD ONE IS. The prototype
   * routes both through `isTouched` (`isShowErr`), and for "กรุณาระบุรายละเอียด" that is exactly
   * right — an untouched field must not be scolded for being empty. Over-length is the opposite
   * case: the reader has typed 501 characters, so it cannot be premature, and it is the reason the
   * submit button is dead. Leaving it hidden until blur means a disabled button with the
   * explanation one interaction away, which is the failure `AC-14` is written to prevent.
   */
  const showDescError = draft.touched.desc ? !!messages.desc : overLength

  const send = useCallback(
    async (current: IssueDraft) => {
      setBusy(true)
      setSubmitError(null)
      setVenueError(null)

      const body: CreateFeedback = {
        type: IS_TYPES[current.type].apiType,
        /* Trimmed on both sides, and counted after trimming — `E-9`'s 500/501 boundary only holds
           if the two agree about what is being counted. */
        subject: current.subject.trim(),
        description: current.description.trim(),
      }
      if (current.venue !== IS_GENERAL_VENUE) body.venueId = current.venue
      const urls = current.photos
        .map((p) => p.uploadedUrl)
        .filter((url): url is string => url !== null)
      if (urls.length) body.photos = urls

      try {
        const result = await submitFeedback(body)
        /* 🔴 CLEARED BEFORE THE DIALOG OPENS (`AC-28`) — and cleared even when the user has already
           navigated away, so coming back finds an empty form rather than a re-submittable copy of
           something that has already been filed. */
        const cleared = resetDraft()
        if (!alive.current) return
        setDraft(cleared)
        setSent(result)
      } catch (error) {
        if (!alive.current) return
        /* `E-5` · the venue went away between load and submit. It belongs ON the select, with the
           options refreshed — never as a generic sentence, and never a silent drop to ทั่วไป. */
        if (isVenueRefusal(error)) {
          setVenueError(VENUE_REFUSED_MESSAGE)
          void loadVenues()
        } else {
          setSubmitError(messageFor(error))
        }
        /* `E-4` — the draft is untouched, so a retry costs one tap. */
      } finally {
        if (alive.current) setBusy(false)
      }
    },
    [loadVenues],
  )

  /**
   * The net, not the first line of defence (`AC-17`).
   *
   * The button is already disabled while the form is invalid — but Enter inside the subject field
   * must still produce the errors and land the caret on the field to fix, rather than doing
   * nothing. Both the `<form>`'s submit and that keystroke arrive here.
   */
  const attemptSubmit = useCallback(() => {
    if (busy || uploading) return
    const next = update({ touched: { subject: true, desc: true } })
    const m = issueMessages(next.subject, next.description)
    if (!issueIsValid(m)) {
      ;(m.subject ? subjectRef.current : descRef.current)?.focus()
      return
    }
    void send(next)
  }, [busy, uploading, update, send])

  // ── The success dialog ───────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (sent) dialogRef.current?.showModal()
  }, [sent])

  /* `AC-30`/`AC-31` — a route change unmounts this screen, and the dialog must not be the thing
     that survives it. Removing the element closes it; this makes that explicit rather than
     inherited. */
  useEffect(() => {
    const dialog = dialogRef.current
    return () => dialog?.close()
  }, [])

  const closeDialog = useCallback(() => dialogRef.current?.close(), [])

  /* The summary is read back out of the RESPONSE, because the form it was typed into has already
     been cleared. `venueName` exists in the DTO for exactly this reason (`02_design_log.md` §4.1).
     The type word is a table lookup, not a branch — `AC-7` holds here too. */
  const sentType: IssueTypeKey =
    (sent && IS_TYPE_ORDER.find((k) => IS_TYPES[k].apiType === sent.type)) || 'issue'

  return (
    /* ⚠️ NO `pad-nav` — see the header note. `LiffShell` owns dock clearance. */
    <section className="min-h-dvh">
      <ScreenHeader
        title="แจ้งปัญหา / ข้อเสนอแนะ"
        width={SCREEN_WIDTH_NARROW}
        breadcrumbs={[
          { label: 'ตั้งค่า', to: '/settings' },
          { label: 'แจ้งปัญหา / ข้อเสนอแนะ' },
        ]}
      />

      {/* ⚠️ `noValidate` — the browser's own bubbles vanish after five seconds and speak a
          different language from the app. Every message here is ours, rendered persistently under
          its field (`AC-15`), the same rule `#/request/:id` follows. */}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          attemptSubmit()
        }}
        className={`${SCREEN_WIDTH_NARROW} pt-4`}
      >
        {/* ─── The type switcher ─────────────────────────────────────────────────────────────
            ⚠️ A `join` OF TWO BUTTONS, NOT daisyUI `tabs` (proto 1716–1719). It does not swap
            PANELS; it changes what the one form MEANS — and this app already has exactly this
            control on the booking form. Two looks for one kind of decision is a mismatch the eye
            catches before the brain does. */}
        <div className="card bg-base-100 shadow-sm">
          <div className="card-body gap-0 p-4">
            <span className="block text-center text-sm font-medium text-base-content">
              ต้องการแจ้งเรื่องอะไร
            </span>
            <p className="mb-3 mt-1 text-center text-xs text-base-content/70">{type.note}</p>
            <div className="join w-full" role="group" aria-label="ประเภทเรื่องที่แจ้ง">
              {IS_TYPE_ORDER.map((key) => {
                const row = IS_TYPES[key]
                const active = key === draft.type
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    /* 🔴 THE STATE IS `aria-pressed` AND THE COLOUR FOLLOWS IT — one value, so the
                       screen reader and the eye can never be told different things. */
                    onClick={() => {
                      if (!active) update({ type: key })
                    }}
                    className={`btn btn-app join-item !h-auto !min-h-16 min-w-0 grow basis-0 flex-col gap-1 px-1 py-2 !text-sm sm:!min-h-12 sm:flex-row sm:gap-1.5 sm:!text-base${
                      active ? ' btn-neutral' : ''
                    }`}
                  >
                    <LIcon name={row.icon} />
                    <span className="truncate">{row.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ─── Card 1 · the venue ────────────────────────────────────────────────────────────
            ⚠️ A NATIVE `<select>`, NOT THE `cbx-sheet` COMBOBOX (proto 1770–1773). The sheet is
            for long lists that need searching (ตำแหน่ง · กลุ่มสาระ); ten options are one glance in
            the system menu.
            ⚠️ THE DEFAULT IS ปัญหาทั่วไป AND THE FIELD IS OPTIONAL. Forcing a venue makes people
            pick any room at all to get past the field, which is worse than not knowing. */}
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-base-content">เกี่ยวกับเรื่องที่แจ้ง</h2>
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-4 p-4">
              <label className="block">
                <span className="mb-1 block text-xs text-base-content/70">{type.venueLabel}</span>
                <select
                  value={draft.venue}
                  onChange={(e) => {
                    setVenueError(null)
                    update({ venue: e.target.value })
                  }}
                  aria-describedby="is-venue-note"
                  className={`select select-lg w-full${venueError ? ' select-error' : ''}`}
                >
                  <option value={IS_GENERAL_VENUE}>{IS_GENERAL_VENUE_LABEL}</option>
                  {venues && venues.length > 0 ? (
                    <optgroup label="สถานที่">
                      {venues.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
                {/* One status line, always present, so nothing below it moves when the list
                    finishes loading or a refusal appears. `min-h-4` = one `text-xs` line. */}
                <span
                  id="is-venue-note"
                  aria-live="polite"
                  className={`mt-1 block min-h-4 text-xs ${
                    venueError ? 'text-error' : 'text-base-content/60'
                  }`}
                >
                  {venueError ??
                    (venuesFailed
                      ? 'โหลดรายชื่อสถานที่ไม่สำเร็จ — ส่งเรื่องแบบไม่ระบุสถานที่ได้ตามปกติ'
                      : venues === null
                        ? 'กำลังโหลดรายชื่อสถานที่…'
                        : '')}
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* ─── Card 2 · the report ───────────────────────────────────────────────────────────── */}
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-base-content">รายละเอียด</h2>
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-4 p-4">
              <label className="block">
                <span className="mb-1 block text-xs text-base-content/70">
                  หัวข้อ <span className="text-error">*</span>
                </span>
                <input
                  ref={subjectRef}
                  type="text"
                  maxLength={IS_MAX_SUBJECT}
                  autoComplete="off"
                  value={draft.subject}
                  placeholder={type.subject}
                  onChange={(e) => update({ subject: e.target.value })}
                  onBlur={() => update((prev) => ({ touched: { ...prev.touched, subject: true } }))}
                  onKeyDown={(e) => {
                    /* Enter in a single-line field means "send" — and when the form is not ready,
                       it must say WHY rather than doing nothing. A disabled default button
                       suppresses implicit submission in Chrome, so `AC-17` cannot rely on the
                       form's own submit event; this is that guarantee. */
                    if (e.key !== 'Enter') return
                    e.preventDefault()
                    attemptSubmit()
                  }}
                  aria-describedby="is-subject-err"
                  aria-invalid={draft.touched.subject && !!messages.subject}
                  className={`input input-lg w-full${
                    draft.touched.subject && messages.subject ? ' input-error' : ''
                  }`}
                />
                <span id="is-subject-err" className="mt-1 block text-xs text-error">
                  {draft.touched.subject ? messages.subject : ''}
                </span>
              </label>

              {/* ⚠️ NO `maxLength` ON THE TEXTAREA (`AC-12`), AND ITS ABSENCE IS THE FEATURE.
                  `maxlength` truncates pasted text silently and the writer never learns that the
                  end of their paragraph is gone. The counter turns red and the button is disabled
                  instead. */}
              <label className="block">
                <span className="mb-1 block text-xs text-base-content/70">
                  รายละเอียด <span className="text-error">*</span>
                </span>
                <textarea
                  ref={descRef}
                  rows={5}
                  value={draft.description}
                  placeholder={type.desc}
                  onChange={(e) => update({ description: e.target.value })}
                  onBlur={() => update((prev) => ({ touched: { ...prev.touched, desc: true } }))}
                  aria-describedby="is-desc-count is-desc-err"
                  aria-invalid={showDescError}
                  className={`textarea w-full text-base${showDescError ? ' textarea-error' : ''}`}
                />
                <span className="mt-1 flex items-start justify-between gap-2 text-xs">
                  <span id="is-desc-err" className="text-error">
                    {showDescError ? messages.desc : ''}
                  </span>
                  <span
                    id="is-desc-count"
                    aria-live="polite"
                    className={`ms-auto shrink-0 tabular-nums ${
                      overLength ? 'text-error' : 'text-base-content/60'
                    }`}
                  >
                    {descLength}/{IS_MAX_DESC}
                  </span>
                </span>
              </label>

              {/* ─── Photos ───
                  ⚠️ THE `<label>` WRAPS A REAL `<input type="file">`, so tapping anywhere in the
                  dashed frame opens the camera or the gallery — including inside LINE's webview
                  (`AC-18`). Drag-and-drop is a desktop bonus on top of that, not the mechanism.
                  ⚠️ `accept="image/*"` IS WIDER THAN THE ALLOWLIST ON PURPOSE. Narrowing it to
                  `image/jpeg,image/png` is what greys out the camera roll on some iOS builds and
                  blocks the HEIC→JPEG conversion the picker does for us. The strict JPG/PNG check
                  happens in `screenFiles`, where it can produce a Thai sentence naming the file.
                  ⚠️ THE FRAME IS REMOVED AT THREE PHOTOS, NOT DISABLED (`AC-19`) — a frame that
                  does nothing when tapped is a dead end. It cannot be the `hidden` attribute
                  either: `display:flex` from the utility beats the UA's `[hidden]` rule. */}
              <div>
                <span className="mb-1 flex items-center justify-between gap-2 text-xs text-base-content/70">
                  <span>
                    แนบรูปภาพ <span className="text-base-content/60">(ไม่บังคับ)</span>
                  </span>
                  <span className="tabular-nums text-base-content/60">
                    {draft.photos.length}/{IS_MAX_PHOTOS}
                  </span>
                </span>

                {draft.photos.length < IS_MAX_PHOTOS ? (
                  <label
                    data-over={dragOver ? '' : undefined}
                    onDragEnter={(e) => {
                      e.preventDefault()
                      setDragOver(true)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOver(true)
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault()
                      setDragOver(false)
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDragOver(false)
                      addFiles(e.dataTransfer?.files ?? null)
                    }}
                    className="is-drop flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-box border-2 border-dashed border-base-300 bg-base-200/50 px-4 py-5 text-center motion-safe:transition-colors"
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={(e) => {
                        addFiles(e.target.files)
                        /* Re-picking the SAME file after removing it must fire `change` again. */
                        e.target.value = ''
                      }}
                    />
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"
                    >
                      <LIcon name="imagePlus" className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-medium">แตะเพื่อถ่ายหรือเลือกรูปภาพ</span>
                    <span className="text-xs text-base-content/60">
                      JPG / PNG ไม่เกิน 5 MB · สูงสุด 3 รูป
                    </span>
                  </label>
                ) : null}

                <span aria-live="polite" className="mt-1 block text-xs text-error">
                  {draft.photoError ?? ''}
                </span>

                {draft.photos.length > 0 ? (
                  <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {draft.photos.map((photo) => (
                      <li
                        key={photo.id}
                        className="flex items-center gap-3 rounded-field border border-base-300 bg-base-100 p-2"
                      >
                        {/* Decorative: the filename is right beside it. */}
                        <img
                          src={photo.previewUrl}
                          alt=""
                          className="h-11 w-11 shrink-0 rounded-md object-cover"
                        />
                        <div className="min-w-0 grow">
                          <p className="truncate text-sm">{photo.name}</p>
                          <p className="flex items-center gap-1.5 text-xs tabular-nums text-base-content/60">
                            <span>{fmtPhotoSize(photo.size)}</span>
                            {/* `E-3` made visible: while this row says "กำลังอัปโหลด" the submit
                                button is disabled, so the reason it is disabled is on screen. */}
                            {photo.uploadedUrl === null ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <span
                                  aria-hidden="true"
                                  className="loading loading-spinner loading-xs"
                                />
                                <span>กำลังอัปโหลด…</span>
                              </>
                            ) : null}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label={`ลบรูป ${photo.name}`}
                          onClick={() => removePhoto(photo)}
                          className="btn btn-ghost btn-sm btn-circle shrink-0"
                        >
                          <LIcon name="x" className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Card 3 · the reporter ──────────────────────────────────────────────────────────
            ⚠️ READ-ONLY, WITH NO EDIT BUTTON. Identity comes from the approved LINE registration
            and editing lives in exactly one place ("แก้ไขข้อมูลลงทะเบียน"). What this card is FOR
            is saying *เรื่องนี้ไม่ใช่บัตรสนเท่ห์* — that staff can reply to a named person.
            ⚠️ THE "ยืนยันตัวตนผ่าน LINE แล้ว" BADGE SITS BELOW THE ROLE LINE, NEVER BESIDE THE
            NAME (`AC-26`). Measured at 375 px in the prototype: beside the name it eats ~115 px and
            "ครูผู้สอน · กลุ่มสาระภาษาไทย" truncates mid-word — an identity cut in half is the one
            thing this card must not do. */}
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold text-base-content">ข้อมูลผู้แจ้ง</h2>
          <div className="card bg-base-100 shadow-sm">
            <div className="card-body gap-3 p-4">
              {registration ? (
                <div className="flex items-start gap-3">
                  <div className={`avatar shrink-0 ${picture ? '' : 'avatar-placeholder'}`.trim()}>
                    {picture ? (
                      <div className="w-11 rounded-full">
                        <img src={picture} alt="" referrerPolicy="no-referrer" />
                      </div>
                    ) : (
                      <div className="w-11 rounded-full bg-neutral text-neutral-content">
                        <span className="text-base font-medium">
                          {registration.firstName.slice(0, 2)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 grow">
                    <p className="truncate text-sm font-semibold leading-tight">
                      {registration.firstName} {registration.lastName}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-base-content/70">
                      {registration.personnelRole} · {registration.department}
                    </p>
                    {/* 🔴 A BADGE, NEVER GREEN TEXT — `text-success` measures ~3.5:1 in the light
                        theme. `bg-success/20` + `text-base-content` is the same formula the
                        booking status badges use. */}
                    <span className="badge badge-sm mt-1.5 gap-1 whitespace-nowrap border-success/40 bg-success/20 text-base-content">
                      <LIcon name="circleCheck" className="h-3.5 w-3.5 shrink-0" />
                      ยืนยันตัวตนผ่าน LINE แล้ว
                    </span>
                  </div>
                </div>
              ) : (
                /* `E-6` — the gate routes an unregistered user away from this screen, so this is a
                   guard rather than a real state. It keeps the card's proportions instead of
                   drawing half an identity or inventing a name. */
                <div className="flex items-start gap-3">
                  <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
                  <div className="min-w-0 grow space-y-2 py-1">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                </div>
              )}
              {/* The line breaks by hand: browsers break Thai mid-word ("ความคืบ|หน้า"). */}
              <p className="flex items-start gap-1.5 rounded-field bg-base-200/60 px-3 py-2 text-xs text-base-content/70">
                <LIcon name="lock" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  เรื่องที่แจ้งผูกกับบัญชี LINE ของคุณ
                  <br />
                  เจ้าหน้าที่จะแจ้งผลกลับทาง LINE OA
                </span>
              </p>
            </div>
          </div>
        </div>

        {submitError ? (
          <div role="alert" className="alert alert-error alert-soft mt-6 text-sm">
            <LIcon name="circleX" className="h-5 w-5 shrink-0" />
            <span className="text-base-content">{submitError}</span>
          </div>
        ) : null}

        {/* `E-3`'s caption for the submit button. ⚠️ ABOVE THE BUTTON BLOCK, NEVER BETWEEN THE TWO
            BUTTONS — the same move `#/request/:id` made (`#ISSUE-04`): a line wedged inside the
            action block (even an empty `min-h-4` one, plus two `gap-2`s) held ส่งข้อมูล and ยกเลิก
            32px apart and stopped them reading as one set of choices. The `<p>` exists only while
            uploading, so the idle form reserves nothing for it.
            ⚠️ AFTER `submitError`, not before it: the caption stays against the button it
            describes, and an upload started after a failed submit inserts it BELOW the alert
            rather than pushing an error the user is reading down the screen.
            ⚠️ `aria-live` IS ON THE WRAPPER, WHICH IS ALWAYS MOUNTED. A live region that is
            inserted already holding its text is announced unreliably; inserting text INTO a region
            that already exists is the case screen readers handle. Empty, the wrapper is 0px tall. */}
        <div aria-live="polite">
          {uploading ? (
            <p id="is-submit-note" className="mt-3 text-center text-xs text-base-content/60">
              กำลังอัปโหลดรูปภาพ — ส่งได้เมื่ออัปโหลดเสร็จ
            </p>
          ) : null}
        </div>

        <div className="mb-8 mt-4 flex flex-col gap-2">
          {/* `AC-16` + `E-3`: invalid, submitting, OR an upload still in flight. The last of the
              three explains itself on the photo row and in `#is-submit-note` above this block,
              never in a sentence between the buttons. `aria-describedby` follows the caption's
              existence, so it never points at an id that is not in the DOM. */}
          <button
            type="submit"
            disabled={!valid || busy || uploading}
            aria-describedby={uploading ? 'is-submit-note' : undefined}
            className="btn btn-app btn-primary w-full gap-2 shadow-sm"
          >
            {busy ? (
              <span aria-hidden="true" className="loading loading-spinner loading-sm" />
            ) : (
              <LIcon name="send" />
            )}
            <span>{busy ? 'กำลังส่ง…' : 'ส่งข้อมูล'}</span>
          </button>
          <Link
            to="/settings"
            className="btn btn-app btn-outline w-full border-base-300 text-base-content/80"
          >
            ยกเลิก
          </Link>
        </div>
      </form>

      {/* ═══ The success dialog ═════════════════════════════════════════════════════════════════
          ⚠️ A `<dialog class="modal">`, NOT A `#/sent/:id` SCREEN, and the prototype says why: a
          submitted report has no detail screen to link to (there is no "เรื่องที่ฉันแจ้ง" list), so
          there is no destination for LIFF's back button to walk to.
          ⚠️ IT IS A SIBLING OF THE `<form>`, never a child — daisyUI's canonical backdrop is itself
          a `<form>`, and nesting one inside another is invalid HTML that React logs on every
          render. `#/register` measured exactly that before the combobox was portalled out.
          ⚠️ THE BACKDROP IS A `<div>` WITH AN EXPLICIT `close()`. Under React 19 the canonical
          `<form method="dialog">` never closes the dialog: React owns form submits now and the
          browser's dialog default is prevented. daisyUI documents this shape too, so the styling is
          unchanged. */}
      <dialog
        ref={dialogRef}
        onClose={() => setSent(null)}
        aria-labelledby="is-ok-title"
        className="modal modal-middle"
      >
        {sent ? (
          <div className="modal-box max-w-sm text-center">
            {/* The three animation layers are all `motion-safe`; `.sent-pop` / `.sent-draw` are
                opt-in under `prefers-reduced-motion: no-preference` in `index.css`. What reduced
                motion removes is the movement, not the mark. Mounting fresh on each submit is what
                replays them — the prototype has to remove and re-add the classes by hand. */}
            <div className="relative mx-auto h-16 w-16">
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-success/30 opacity-75 motion-safe:animate-ping [animation-iteration-count:2]"
              />
              <span
                aria-hidden="true"
                className="sent-pop relative flex h-16 w-16 items-center justify-center rounded-full bg-success text-success-content shadow-md"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-8 w-8"
                >
                  {/* `M4 12l5 5L20 6`, never the mirrored form — a `stroke-dashoffset` animation
                      draws in the order the path is written. */}
                  <path
                    className="sent-draw"
                    strokeDasharray="24"
                    strokeDashoffset="0"
                    d="M4 12l5 5L20 6"
                  />
                </svg>
              </span>
            </div>

            <h3 id="is-ok-title" className="mt-4 text-lg font-semibold">
              ส่งเรื่องเรียบร้อยแล้ว
            </h3>
            <p className="mt-1 text-xs text-base-content/70">
              ขอบคุณที่ช่วยแจ้งให้เราทราบ
              <br />
              เจ้าหน้าที่จะตรวจสอบและแจ้งผลกลับทาง LINE
            </p>

            <div className="mt-4 rounded-box bg-base-200/60 p-3 text-start text-xs">
              <div className="flex items-center justify-between gap-2 border-b border-base-300 pb-2">
                <span className="text-base-content/60">เลขอ้างอิง</span>
                {/* 🔴 `sent.code`, THE SERVER'S (`AC-37`). `font-mono` because this is a value a
                    person reads down a phone line, character by character. */}
                <span className="font-mono text-sm font-semibold">{sent.code}</span>
              </div>
              <dl>
                {[
                  ['ประเภท', IS_TYPES[sentType].kind],
                  ['สถานที่', sent.venueName ?? IS_GENERAL_VENUE_LABEL],
                  ['หัวข้อ', sent.subject],
                  /* `AC-29` — the photo row appears only when there were photos. */
                  ...(sent.photos.length > 0
                    ? [['รูปภาพแนบ', `${sent.photos.length} รูป`] as const]
                    : []),
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-start justify-between gap-3 border-b border-base-300/60 py-1.5 last:border-b-0"
                  >
                    <dt className="shrink-0 text-base-content/60">{label}</dt>
                    <dd className="min-w-0 break-words text-end font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="modal-action mt-5 flex-col gap-2">
              {/* Closing FIRST, then navigating: the dialog's `close` event is the single place the
                  confirmation is dropped, and leaving it to unmount would skip it. */}
              <Link
                to="/settings"
                onClick={closeDialog}
                className="btn btn-app btn-primary w-full shadow-sm"
              >
                กลับสู่หน้าตั้งค่า
              </Link>
              <button
                type="button"
                onClick={closeDialog}
                className="btn btn-app btn-ghost w-full"
              >
                แจ้งเรื่องอื่นเพิ่ม
              </button>
            </div>
          </div>
        ) : null}
        <div className="modal-backdrop">
          <button type="button" onClick={closeDialog}>
            ปิด
          </button>
        </div>
      </dialog>
    </section>
  )
}

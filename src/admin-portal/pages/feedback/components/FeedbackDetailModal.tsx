/**
 * รายละเอียดเรื่องที่แจ้ง — the read surface AND the one write, in one dialog (prototype 9220–9456).
 *
 * The write is small — a status and an internal note — and it reaches nobody but the staff who read
 * the log, so it gets no separate confirm step (คำขอจองสถานที่ splits its writes into dialogs because
 * those send a LINE message; nothing here does).
 *
 * ── SIX CARDS ON A TINTED WELL, in one order ──
 * รหัสและสถานะ → เรื่องที่แจ้ง → ผู้ส่งเรื่อง → รายละเอียดและรูปภาพ → ประวัติการดำเนินการ →
 * อัปเดตสถานะ. Read top-down: which / what / who / evidence / what we did / what we do next.
 * `bg-base-200` on the well and `bg-base-100` on the cards: between two near-identical light
 * surfaces the tint is what makes six boxes read as six sections rather than one long form.
 *
 * ── Three roles ──
 * Card 6 and the footer's save button are RENDERED ONLY for `canWrite` (D-9) — conditional
 * rendering, not `[data-write-only]`, which loses to any display utility. A VIEWER reads the whole
 * record, its photos and its log, and closes with ✕ or Escape. ⚠️ This is UX; `@Roles` on the PATCH
 * is the control.
 *
 * ── Dismissal ──
 * ✕ and Escape only: `Modal` never closes on the backdrop, so a half-written note is not lost to a
 * click a few pixels outside the card. While a save is in flight nothing closes it
 * (`dismissable={!busy}`). Escape closes an open photo viewer FIRST — `FeedbackLightbox` owns that
 * key while it is mounted — and a second Escape closes the dialog.
 */

import { useEffect, useRef, useState } from 'react'
import { ApiError } from '@/lib/api-client'
import { InlineAlert } from '../../../components/feedback/InlineAlert'
import { Skeleton, SkeletonRegion } from '../../../components/feedback/Skeleton'
import { Spinner } from '../../../components/feedback/Spinner'
import { Badge } from '../../../components/ui/Badge'
import { Btn } from '../../../components/ui/Btn'
import { SelectField } from '../../../components/ui/FormField'
import { Modal } from '../../../components/ui/Modal'
import { FEEDBACK_STATUS, FEEDBACK_TYPE, type FeedbackStatus } from '../../../labels'
import { thaiDate, thaiTime } from '../../../lib/thai-date'
import { useBusy } from '../../../lib/use-busy'
import {
  isNothingToSave,
  updateFeedback,
  type FeedbackDetail,
  type FeedbackListItem,
  type UpdateFeedbackBody,
} from '../feedback-api'
import { ICON } from '../feedback-icons'
import {
  NO_AUTHOR,
  hasReporterName,
  initials,
  isUpdatable,
  reporterName,
  reporterRoleLine,
  statusLabel,
  thaiAt,
} from '../feedback-record'
import { FeedbackLightbox } from './FeedbackLightbox'
import { Glyph } from './FeedbackGlyph'

/** The server's own ceiling on the note (after trimming), so `maxLength` stops the 501st character. */
const NOTE_MAX = 500

/** The prototype's save rule (20775–20778): same status and a blank note sends NOTHING. */
const NO_CHANGE = 'ยังไม่มีการเปลี่ยนแปลง — เลือกสถานะใหม่ หรือเขียนบันทึกการดำเนินการก่อนกดบันทึก'

/** Any other refusal. Nothing was written, and what was typed stays in the box (AC-49). */
const SAVE_FAILED = 'บันทึกไม่สำเร็จ ยังไม่มีอะไรเปลี่ยนแปลง · ลองใหม่อีกครั้ง'

/** The statuses the select offers, in the prototype's order. `DISMISSED` is never one (OQ-1). */
const OFFERED: readonly FeedbackStatus[] = ['PENDING', 'IN_PROGRESS', 'RESOLVED']

export function FeedbackDetailModal({
  open,
  onClose,
  row,
  detail,
  loading,
  failed,
  onRetry,
  canWrite,
  onSaved,
  onStale,
  onGone,
}: {
  open: boolean
  onClose: () => void
  /** The row it was opened from — carries the code before the fetch lands. */
  row: FeedbackListItem | null
  /** `null` while loading or after a failure — never a half-painted record (E-11). */
  detail: FeedbackDetail | null
  loading: boolean
  failed: boolean
  onRetry: () => void
  /** `acl.write`. False = no card 6 and no footer, not disabled controls. */
  canWrite: boolean
  /** The PATCH landed. `before` is the status the operator was looking at when they pressed save. */
  onSaved: (saved: FeedbackDetail, before: FeedbackStatus) => void
  /** The server found nothing to record — the record moved under the dialog. Re-read it. */
  onStale: () => void
  /** The report no longer exists (404 on save). */
  onGone: () => void
}) {
  const [note, setNote] = useState('')
  const [alert, setAlert] = useState<string | null>(null)
  /**
   * The operator's pick in the status select, TIED TO THE DETAIL OBJECT it was made on. A fresh
   * detail (a new record, or a re-read after `onStale`) no longer matches, so the select falls back
   * to that record's own status — the "preset on every open" rule without an effect that would
   * paint one frame of the previous record's choice.
   */
  const [pick, setPick] = useState<{ of: FeedbackDetail; status: FeedbackStatus } | null>(null)
  /** The open photo, zero-based. `null` = the viewer is closed. */
  const [photo, setPhoto] = useState<number | null>(null)
  const photoFrom = useRef<HTMLElement | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const { busy, run, buttonProps } = useBusy()

  /*
   * ⚠️ RESET ON OPEN, during render rather than in an effect, so a reopened dialog never shows the
   * last record's note or alert for a frame. A FAILED save leaves the dialog open, so this does not
   * run and every keystroke survives (AC-49).
   */
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setNote('')
      setAlert(null)
      setPick(null)
      setPhoto(null)
    }
  }

  // AFTER showModal() (the child `Modal`'s effect runs first): a closed dialog has no scroll box, so
  // resetting it before opening is silently dropped and the old offset comes back.
  useEffect(() => {
    if (open && bodyRef.current) bodyRef.current.scrollTop = 0
  }, [open])

  const toTop = () => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }

  const selected: FeedbackStatus | null = detail
    ? pick && pick.of === detail
      ? pick.status
      : detail.status
    : null

  /*
   * ⚠️ `disabled` BLURS the button it lands on. A save that FAILS leaves the dialog open, so without
   * this a keyboard operator would be on <body> reading an alert about a button they can no longer
   * reach. Re-focused once `busy` has cleared — focusing a still-disabled button does nothing.
   */
  const saveRef = useRef<HTMLButtonElement>(null)
  const refocusSave = useRef(false)
  useEffect(() => {
    if (busy || !refocusSave.current) return
    refocusSave.current = false
    saveRef.current?.focus()
  }, [busy])

  const save = () => {
    if (!detail || !canWrite || selected === null || busy) return
    const before = detail.status
    const trimmed = note.trim()
    // Checked BEFORE going busy: nothing is sent, so nothing should flicker or lose focus.
    if (selected === before && !trimmed) {
      setAlert(NO_CHANGE)
      toTop()
      return
    }
    /* The status is sent ONLY when it differs from what the operator is looking at. A note-only
       save must not re-assert that status: if another operator moved the record meanwhile,
       sending it back would silently undo their change. */
    const body: UpdateFeedbackBody = {}
    if (selected !== before && isUpdatable(selected)) body.status = selected
    if (trimmed) body.note = trimmed
    setAlert(null)
    return run(async () => {
      try {
        const saved = await updateFeedback(detail.id, body)
        onSaved(saved, before)
      } catch (err) {
        if (isNothingToSave(err)) {
          // Somebody else already set the status picked here. Say so in the save rule's own words
          // and re-read the record, so the badge and the select stop claiming the old state.
          setAlert(NO_CHANGE)
          onStale()
        } else if (err instanceof ApiError && err.status === 404) {
          onGone()
          return
        } else {
          // 400 (validation), 403 surviving the CSRF retry, 5xx, offline — nothing was written. A
          // 401 lands here too, AND raises the session-expired dialog through the shared client.
          setAlert(SAVE_FAILED)
        }
        refocusSave.current = true
        toTop()
      }
    })
  }

  const closePhoto = () => {
    // Back to the thumbnail that opened it, BEFORE the layer unmounts — it is under the layer,
    // not detached, so it can take focus now.
    const back = photoFrom.current
    photoFrom.current = null
    if (back?.isConnected) back.focus()
    setPhoto(null)
  }

  const footer =
    canWrite && detail ? (
      <Btn
        ref={saveRef}
        variant="primary"
        className="w-full sm:w-auto"
        onClick={() => void save()}
        {...buttonProps('กำลังบันทึกการดำเนินการ')}
      >
        {busy ? <Spinner /> : <Glyph d={ICON.save} className="cm-btn-ico" />}
        บันทึกการดำเนินการ
      </Btn>
    ) : null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="รายละเอียดเรื่องที่แจ้ง"
      width={640}
      dismissable={!busy}
      bodyRef={bodyRef}
      bodyClassName="space-y-3 bg-base-200 px-4 py-4 sm:px-5"
      footerClassName="flex flex-col gap-2 sm:flex-row sm:justify-end"
      footer={footer}
      overlay={
        open && detail && photo !== null && detail.photos.length > 0 ? (
          <FeedbackLightbox
            photos={detail.photos}
            index={Math.min(photo, detail.photos.length - 1)}
            code={detail.code}
            onIndex={setPhoto}
            onClose={closePhoto}
          />
        ) : null
      }
    >
      <InlineAlert message={alert} className="!mb-0" />

      {failed ? (
        /* One sentence and a retry, not `<LoadError>`: that panel is a full-page state with its own
           <h2> and its own focus move, which would fight the dialog's heading and focus. */
        <div className="fb-sec py-6 text-center">
          <p className="m-0 text-[15px] font-medium text-base-content">โหลดรายละเอียดไม่สำเร็จ</p>
          <p className="mt-1.5 text-[14px] leading-[1.6] text-base-content/70">
            ระบบดึงข้อมูลเรื่อง {row?.code ?? ''} ไม่ได้ · ข้อมูลในระบบยังอยู่ครบ ลองใหม่อีกครั้ง
          </p>
          <Btn variant="primary" className="mx-auto mt-4 w-fit" onClick={onRetry}>
            <Glyph d={ICON.refresh} className="cm-btn-ico" />
            ลองใหม่อีกครั้ง
          </Btn>
        </div>
      ) : loading || !detail || selected === null ? (
        <DetailSkeleton code={row?.code ?? ''} />
      ) : (
        <>
          {/* ── 1 · รหัสและสถานะ ── the code leads: this dialog is usually open because somebody
              read a code out over the phone. `!py-3`: one row of pills in a 16px frame reads as a
              half-empty box. Named by aria-label — there is no visible heading to point at. */}
          <section className="fb-sec !py-3" aria-label="รหัสอ้างอิงและสถานะ">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`fb-code text-[14px] ${FEEDBACK_TYPE[detail.type].code}`}>
                {detail.code}
              </span>
              <span className="fb-type">{FEEDBACK_TYPE[detail.type].label}</span>
              <Badge tone={FEEDBACK_STATUS[detail.status].tone}>
                {statusLabel(detail.status, detail.type)}
              </Badge>
            </div>
          </section>

          {/* ── 2 · เรื่องที่แจ้ง ── `leading-[1.6]` because Thai upper marks need the half-leading
              against the card edge; `mt-4` on the meta line is the prototype's measured value. */}
          <section className="fb-sec" aria-labelledby="fb-d-subject">
            <h3
              id="fb-d-subject"
              className="text-[17px] font-semibold leading-[1.6] text-base-content"
            >
              {detail.subject}
            </h3>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-base-300 pt-3 text-[14px] text-base-content/80">
              <span className="flex min-w-0 items-center gap-1.5">
                <Glyph d={ICON.pin} className="h-4.5 w-4.5 shrink-0 text-base-content/60" />
                <span className="sr-only">สถานที่: </span>
                <span className="min-w-0">
                  {detail.venue?.name ?? 'ปัญหาทั่วไป / ไม่ระบุสถานที่'}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <Glyph d={ICON.calendar} className="h-4.5 w-4.5 shrink-0 text-base-content/60" />
                <span className="sr-only">วันที่แจ้ง: </span>
                <span className="tabular-nums">
                  {thaiDate(detail.createdAt)} เวลา {thaiTime(detail.createdAt)} น.
                </span>
              </span>
            </div>
          </section>

          <ReporterCard detail={detail} />

          {/* ── 4 · รายละเอียดและรูปภาพ ── ONE card: the words and the photos are the same
              testimony, and splitting them put a boundary between the sentence and its picture. */}
          <section className="fb-sec" aria-labelledby="fb-d-desc-h">
            <h4 id="fb-d-desc-h" className="fb-sec-h">
              <Glyph d={ICON.doc} className="fb-sec-ico" />
              รายละเอียด
            </h4>
            <p className="m-0 whitespace-pre-line text-[15px] leading-[1.7] text-base-content/90">
              {detail.description}
            </p>

            <h5 className="mb-2.5 mt-4 flex items-center gap-1.5 border-t border-base-300 pt-3.5 text-[13px] font-semibold text-base-content/80">
              <Glyph d={ICON.photo} className="h-4 w-4 shrink-0 text-base-content/60" />
              รูปภาพแนบ{' '}
              {detail.photos.length > 0 && (
                <span className="font-normal text-base-content/70 tabular-nums">
                  ({detail.photos.length} รูป)
                </span>
              )}
            </h5>
            {detail.photos.length > 0 ? (
              <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0">
                {detail.photos.map((url, i) => (
                  <li key={url}>
                    <button
                      type="button"
                      className="fb-thumb"
                      aria-label={`ขยายรูปภาพที่ ${i + 1} จาก ${detail.photos.length}`}
                      onClick={(e) => {
                        photoFrom.current = e.currentTarget
                        setPhoto(i)
                      }}
                    >
                      <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                      <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums">
                        {i + 1}/{detail.photos.length}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-[14px] text-base-content/70">ไม่มีรูปภาพแนบ</p>
            )}
          </section>

          <LogCard detail={detail} />

          {/* ── 6 · อัปเดตสถานะ ── write-only, and the one card with a primary edge: the only card
              you type into, tied to the save button directly beneath. */}
          {canWrite && (
            <section className="fb-sec fb-sec-form" aria-labelledby="fb-d-update-h">
              <h4 id="fb-d-update-h" className="fb-sec-h">
                <Glyph d={ICON.pencil} className="fb-sec-ico !text-primary" />
                อัปเดตสถานะการดำเนินงาน
              </h4>
              {/* The app's daisyUI `select` (the 2026-09-21 select refactor), not the prototype's
                  `.form-shell` + `.form-select` + drawn caret. The RESOLVED option names itself for
                  THIS record's type. */}
              <SelectField
                id="fb-d-next"
                label="สถานะ"
                value={selected}
                onChange={(e) =>
                  setPick({ of: detail, status: e.target.value as FeedbackStatus })
                }
              >
                {OFFERED.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s, detail.type)}
                  </option>
                ))}
                {/* A record already in a state the screen does not offer (unreachable today, OQ-1)
                    is SHOWN truthfully and cannot be picked. */}
                {!OFFERED.includes(detail.status) && (
                  <option value={detail.status} disabled>
                    {statusLabel(detail.status, detail.type)}
                  </option>
                )}
              </SelectField>

              <label className="form-label !mb-0.5 mt-4" htmlFor="fb-d-note">
                บันทึกการดำเนินการของเจ้าหน้าที่
              </label>
              {/* Says who reads it, because that changes how people write: this is INTERNAL. */}
              <p id="fb-d-note-hint" className="mb-2 text-[13px] leading-[1.5] text-base-content/70">
                บันทึกภายใน เห็นเฉพาะเจ้าหน้าที่ · ไม่ส่งถึงผู้แจ้ง
              </p>
              <div className="form-shell !px-0">
                <textarea
                  id="fb-d-note"
                  maxLength={NOTE_MAX}
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  aria-describedby="fb-d-note-hint fb-d-note-n"
                  autoCorrect="on"
                  spellCheck
                  autoComplete="off"
                  autoCapitalize="sentences"
                  placeholder="เช่น แจ้งช่างอาคารแล้ว นัดเข้าตรวจสอบวันพรุ่งนี้ 09:00 น."
                  className="min-h-11 w-full resize-y border-none bg-transparent px-3.5 py-2.5 text-[15px] leading-[1.6] text-base-content/90 outline-none placeholder:text-base-content/70"
                />
              </div>
              <p id="fb-d-note-n" className="mt-1.5 text-right text-[13px] text-base-content/70">
                <span className="tabular-nums">{note.length}</span>/{NOTE_MAX}
              </p>
            </section>
          )}
        </>
      )}
    </Modal>
  )
}

/** ── 3 · ผู้ส่งเรื่อง ── ONE fact — a person — so one row with an avatar, not three field rows. */
function ReporterCard({ detail }: { detail: FeedbackDetail }) {
  const r = detail.reporter
  const name = reporterName(r)
  const role = reporterRoleLine(r)
  return (
    <section className="fb-sec" aria-labelledby="fb-d-who-h">
      <h4 id="fb-d-who-h" className="fb-sec-h">
        <Glyph d={ICON.user} className="fb-sec-ico" />
        ผู้ส่งเรื่อง
      </h4>
      <div className="flex items-start gap-3">
        {/* The prototype only mocks initials because its fixtures carry no image; a real reporter's
            LINE picture wins, and the initials disc is the fallback when LINE gave us none. */}
        {r.pictureUrl ? (
          <img
            src={r.pictureUrl}
            alt=""
            className="h-11 w-11 shrink-0 rounded-full border border-base-300 bg-base-100 object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral text-[15px] font-medium text-neutral-content"
          >
            {hasReporterName(r) ? initials(name) : '?'}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[15px] font-semibold text-base-content">{name}</span>
            <span className="rq-src rq-src-line">
              <Glyph d={ICON.verified} className="h-3.5 w-3.5" strokeWidth={2} />
              ยืนยันตัวตนผ่าน LINE
            </span>
          </p>
          {role && <p className="m-0 mt-1 text-[14px] text-base-content/80">{role}</p>}
          {(r.phone || r.lineDisplayName) && (
            <p className="m-0 mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-base-content/70">
              {r.phone && <span className="tabular-nums">{r.phone}</span>}
              {r.lineDisplayName && (
                <span>
                  LINE:{' '}
                  <span className="font-medium text-base-content/80">{r.lineDisplayName}</span>
                </span>
              )}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

/**
 * ── 5 · ประวัติการดำเนินการ ── NEWEST FIRST (D-11): the API sends `createdAt` ASC and the top entry
 * here is the answer to "where is this now". A fresh report has no entries — the submission itself
 * is not one (D-2); its time is in card 2.
 */
function LogCard({ detail }: { detail: FeedbackDetail }) {
  const logs = [...detail.logs].reverse()
  return (
    <section className="fb-sec" aria-labelledby="fb-d-log-h">
      <h4 id="fb-d-log-h" className="fb-sec-h">
        <Glyph d={ICON.clock} className="fb-sec-ico" />
        ประวัติการดำเนินการ
      </h4>
      {logs.length > 0 ? (
        <ol className="m-0 ml-1.5 list-none p-0">
          {logs.map((log) => (
            <li key={log.id} className="fb-log">
              <span className="fb-log-dot" aria-hidden="true" />
              <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-base-content/70">
                <Badge tone={FEEDBACK_STATUS[log.status].tone}>
                  {statusLabel(log.status, detail.type)}
                </Badge>
                <span className="font-medium text-base-content/90">
                  {log.author ? `${log.author.firstName} ${log.author.lastName}` : NO_AUTHOR}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{thaiAt(log.createdAt)}</span>
              </p>
              {log.note !== null && (
                <p className="m-0 mt-1.5 whitespace-pre-line text-[14px] leading-[1.6] text-base-content/90">
                  {log.note}
                </p>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="m-0 text-[14px] text-base-content/70">ยังไม่มีบันทึกการดำเนินการ</p>
      )}
    </section>
  )
}

/**
 * Shaped like the first four cards it stands in for, so nothing jumps when the record lands. The
 * region carries `aria-busy` and ONE announcement, never forty empty bars.
 */
function DetailSkeleton({ code }: { code: string }) {
  return (
    <SkeletonRegion label={`กำลังโหลดรายละเอียดเรื่อง ${code}`.trim()} className="space-y-3">
      <div className="fb-sec !py-3">
        <div className="flex items-center gap-2">
          <Skeleton variant="box" className="h-7 w-28 rounded-full" />
          <Skeleton variant="box" className="h-7 w-32 rounded-full" />
          <Skeleton variant="box" className="h-7 w-24 rounded-full" />
        </div>
      </div>
      <div className="fb-sec">
        <Skeleton className="h-4 w-3/4" />
        <div className="mt-4 flex gap-5 border-t border-base-300 pt-3">
          <Skeleton variant="soft" className="h-3.5 w-32" />
          <Skeleton variant="soft" className="h-3.5 w-40" />
        </div>
      </div>
      <div className="fb-sec">
        <Skeleton className="h-3.5 w-24" />
        <div className="mt-3 flex items-start gap-3">
          <Skeleton variant="box" className="h-11 w-11 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton variant="soft" className="h-3 w-56" />
            <Skeleton variant="soft" className="h-3 w-32" />
          </div>
        </div>
      </div>
      <div className="fb-sec">
        <Skeleton className="h-3.5 w-24" />
        <div className="mt-3 flex flex-col gap-2">
          <Skeleton variant="soft" className="h-3 w-full" />
          <Skeleton variant="soft" className="h-3 w-5/6" />
          <Skeleton variant="soft" className="h-3 w-2/3" />
        </div>
      </div>
    </SkeletonRegion>
  )
}

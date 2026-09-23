import { Link } from 'react-router-dom'
import { StatusCard } from '@/client-portal/components/feedback/StatusCard'
import { useGate } from '@/client-portal/hooks/gate-context'
import { LIcon } from '@/client-portal/icons/LucideIcon'

/**
 * `#/rejected` — returned for revision. Prototype 729–749.
 *
 * ── 🔴 THE REASON IS THE SCREEN ──
 * It is the one thing an operator wrote *for this person*, so it gets a panel of its own rather
 * than a line in the body copy. `whitespace-pre-line` is load-bearing: the reason is free text
 * typed into a textarea in the back-office, and a two-paragraph explanation collapsed into one
 * run of words is a different message from the one that was written.
 *
 * ── ⚠️ THE ACTION RE-ENTERS THE **SAME** FORM A PENDING USER GETS ──
 * There is deliberately no second endpoint and no second screen: re-submitting flips the record
 * back to `PENDING` server-side and clears the reason (`TRANSPORT.md` §3.1). Building a separate
 * "resubmit" form would be a second place for the five fields to diverge.
 *
 * ⚠️ `announce` IS OFF, even though the tone is corrective. `StatusCard`'s `role="alert"` is for
 * something that has just gone wrong while the reader was looking elsewhere; this screen is the
 * whole reason they were sent here, and the heading already says it. The reason panel is a
 * `<section>` with its own heading instead, so a screen reader can be walked to it.
 *
 * ── 🟠 `warning`, NOT `error` ──
 * The prototype draws the same amber medallion as `#/pending` (734), and that is the right call:
 * nothing is broken and nobody is in trouble, the form needs another pass. `error` red is
 * reserved for `#/blocked` and the gate failures, which are things the reader cannot act on.
 */
export function RejectedPage() {
  const { status } = useGate()
  const registration = status?.registration ?? null
  const reason = status?.rejectionReason ?? null

  return (
    <StatusCard
      tone="warning"
      icon={<LIcon name="circleAlert" className="h-7 w-7" />}
      title="ข้อมูลการลงทะเบียนไม่ถูกต้อง"
      description={
        registration
          ? `คุณ ${registration.firstName} กรุณาตรวจสอบรายละเอียดด้านล่างนี้ และแก้ไขข้อมูลเพื่อส่งคำขออนุมัติใหม่อีกครั้ง`
          : 'กรุณาตรวจสอบรายละเอียดด้านล่างนี้ และแก้ไขข้อมูลเพื่อส่งคำขออนุมัติใหม่อีกครั้ง'
      }
      actions={
        <Link to="/register" className="btn btn-app btn-primary w-full">
          แก้ไขข้อมูลการลงทะเบียน
        </Link>
      }
    >
      {/* 🔴 `rejectionReason` IS NON-NULL IFF `access === REJECTED` — the backend states that as an
          invariant, and the service refuses a blank reason on the reject transition with a 400.
          The fallback below is therefore unreachable through the real API; it exists so that a
          contract that ever softens produces a screen that still explains itself, instead of an
          empty panel under a heading promising an explanation. */}
      <section className="mt-6 rounded-box border border-base-300 bg-base-200 p-4 text-start">
        <h2 className="text-xs font-semibold tracking-wide text-base-content/60">
          เหตุผลจากเจ้าหน้าที่
        </h2>
        <p className="mt-1.5 font-medium whitespace-pre-line">
          {reason ?? 'เจ้าหน้าที่ไม่ได้ระบุเหตุผลไว้ กรุณาตรวจสอบข้อมูลของคุณและส่งใหม่อีกครั้ง'}
        </p>
      </section>
    </StatusCard>
  )
}

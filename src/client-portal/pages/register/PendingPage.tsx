import { Link } from 'react-router-dom'
import { summaryRows } from './registration-form'
import { StatusCard } from '@/client-portal/components/feedback/StatusCard'
import { useGate } from '@/client-portal/hooks/gate-context'
import { LIcon } from '@/client-portal/icons/LucideIcon'

/**
 * `#/pending` — the record was received, a human has not looked at it yet. Prototype 706–728.
 *
 * ── 🔴 THE SUMMARY IS IN THE SAME ORDER AS THE FORM ──
 * ชื่อ–สกุล · ตำแหน่ง · กลุ่ม/ฝ่าย · เบอร์โทรศัพท์, from `summaryRows()`, which is also what the
 * form's own field order answers to. A summary that re-orders the fields somebody just filled in
 * makes them re-read it to check nothing moved — so the two orders are one list, in one file,
 * rather than two lists that agree today.
 *
 * ── ⚠️ IT RENDERS THE RECORD THE **SERVER** RETURNED, NOT WHAT WAS TYPED ──
 * `status.registration` comes from `GET /line-users/status` (or from the body a submit answered
 * with). That matters after an admin has corrected a typo: the screen then shows the corrected
 * row, which is what is actually pending, instead of the words this browser last sent.
 *
 * ⚠️ NO `announce`. Waiting is not an alert.
 *
 * ⚠️ `Link`, not a `<button onClick={navigate}>`. It is a destination, so it should be
 * long-pressable, openable in a new tab, and visible in the status bar — the same reason
 * `DockItem` is a `Link`.
 */
export function PendingPage() {
  const { status } = useGate()
  const registration = status?.registration ?? null

  return (
    <StatusCard
      tone="warning"
      icon={<LIcon name="clock" className="h-7 w-7" />}
      title="รอการอนุมัติลงทะเบียน"
      description={
        /* The name is the registered one, not the LINE display name: it is what the reader wrote
           on this form, so it is the name that proves the record on screen is theirs. */
        registration
          ? `ขอบคุณ ${registration.firstName} ระบบได้รับข้อมูลการลงทะเบียนของคุณแล้ว โปรดรอเจ้าหน้าที่พิจารณาอนุมัติสิทธิ์การเข้าใช้งาน`
          : 'ระบบได้รับข้อมูลการลงทะเบียนของคุณแล้ว โปรดรอเจ้าหน้าที่พิจารณาอนุมัติสิทธิ์การเข้าใช้งาน'
      }
      actions={
        <Link to="/register" className="btn btn-app btn-outline w-full">
          แก้ไขข้อมูลลงทะเบียน
        </Link>
      }
    >
      {/* 🟠 THE SUMMARY IS OMITTED WHEN THERE IS NO RECORD, RATHER THAN DRAWN EMPTY. `PENDING`
          without a registration row cannot happen against the real API — the access only exists
          because a row was written — so this branch is for a shape that should be impossible, and
          four labels with blanks beside them would read as data that had gone missing. The rest
          of the screen is still true without it. */}
      {registration ? (
        <dl className="mt-6 space-y-3 border-t border-base-300 pt-5 text-start">
          {summaryRows(registration).map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-4">
              <dt className="shrink-0 text-sm text-base-content/60">{row.label}</dt>
              <dd className="truncate text-end font-medium">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </StatusCard>
  )
}

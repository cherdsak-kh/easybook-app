import { HOUR_OPTIONS, MINUTE_OPTIONS } from '../booking-form'

/**
 * An `HH:MM` picker built from two `<select>`s. Prototype 1310–1318, drawn four times.
 *
 * ── 🔴 WHY NOT `<input type="time">`, WHEN THE DATE FIELDS *ARE* NATIVE ──
 * The prototype makes the split explicitly and it is not an inconsistency: the platform's DATE
 * picker is the one the reader already knows, translated into Thai, and accessible for free — so
 * the form uses it. The platform's TIME picker is the one with a real 12/24-hour problem, which is
 * why this half is drawn by hand. Two different answers because the two controls behave
 * differently, not because nobody decided.
 *
 * ⚠️ TWO CONTROLS, ONE LABEL. The pair sits in a `role="group"` labelled by the caller's `<span>`,
 * because "เวลาเริ่ม" describes both halves and neither `<select>` on its own is the field. Each
 * still carries its own `aria-label` naming which half it is, so a screen reader user landing on
 * the minute box knows what it belongs to without walking back out.
 *
 * ⚠️ THE `:` IS `aria-hidden`. It is punctuation between two named controls; announcing it makes
 * the group read as three items.
 *
 * ⚠️ `select-lg` gives 48px, over the 44px floor — these are the most-pressed controls on the
 * screen and they sit in pairs, where a near-miss lands on the neighbour.
 */
export function TimeSelect({
  id,
  label,
  value,
  onChange,
}: {
  /** Prefix for the two control ids and the group's label id. */
  id: string
  /** What the pair is: `เวลาเริ่ม` / `เวลาสิ้นสุด`. Names both halves. */
  label: string
  /** `HH:MM`. */
  value: string
  onChange: (next: string) => void
}) {
  const [hour = '00', minute = '00'] = value.split(':')

  return (
    <div role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="mb-1 block text-xs text-base-content/70">
        {label}
      </span>
      <div className="flex items-center gap-1">
        <select
          id={`${id}-h`}
          className="select select-lg grow"
          aria-label={`${label} — ชั่วโมง`}
          value={hour}
          onChange={(e) => onChange(`${e.target.value}:${minute}`)}
        >
          {HOUR_OPTIONS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span aria-hidden="true" className="shrink-0 px-1 font-medium text-base-content/60">
          :
        </span>
        <select
          id={`${id}-m`}
          className="select select-lg grow"
          aria-label={`${label} — นาที`}
          value={minute}
          onChange={(e) => onChange(`${hour}:${e.target.value}`)}
        >
          {MINUTE_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <span className="shrink-0 ps-1 text-sm text-base-content/60">น.</span>
      </div>
    </div>
  )
}

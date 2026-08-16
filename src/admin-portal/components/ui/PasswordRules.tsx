/**
 * The live password checklist — `__pwPolicy` + the `pw-rules-tpl` template in the prototype.
 *
 * ONE copy, used by both password screens. The rules are the backend's, and the two must not
 * drift: `POST /auth/system/password` rejects anything that fails them, so a checklist that
 * says otherwise sends the operator into a 400 they were told would not happen.
 *
 * ⚠️ NOT a strength meter, deliberately. A meter scores entropy; this policy counts
 * character classes. Showing a bar that fills up implies a judgement the server does not make
 * — a 40-character passphrase of one class scores "strong" on any meter and is rejected here.
 *
 * The `diff` rule ("ไม่ซ้ำกับรหัสผ่านปัจจุบัน") only appears where a current password exists
 * to differ from. Rendering it greyed-out on a screen that has no current-password field
 * would be a requirement the user cannot act on.
 *
 * Each row carries a visually-hidden state word. The ✓/○ swap is colour AND shape, so it is
 * not colour-alone — but neither reaches a screen reader, and "ผ่านแล้ว" is what does.
 */

import type { PasswordRuleState } from '../../lib/password-policy'
import { PASSWORD_MIN } from '../../lib/password-policy'

const RULES: { key: keyof PasswordRuleState; text: string; wide?: boolean }[] = [
  { key: 'len', text: `อย่างน้อย ${PASSWORD_MIN} ตัวอักษร`, wide: true },
  { key: 'upper', text: 'ตัวพิมพ์ใหญ่ A–Z' },
  { key: 'lower', text: 'ตัวพิมพ์เล็ก a–z' },
  { key: 'digit', text: 'ตัวเลข 0–9' },
  // "เช่น" stays, and three examples are enough: the rule accepts anything that is not a
  // letter, a digit or whitespace, so a list that looked exhaustive would understate it.
  // Five examples fit the 169px column with 8px to spare — one font fallback from wrapping,
  // and a checklist row that wraps stops scanning as a checklist.
  { key: 'special', text: 'อักขระพิเศษ เช่น ! @ #' },
  { key: 'diff', text: 'ไม่ซ้ำกับรหัสผ่านปัจจุบัน', wide: true },
]

export function PasswordRules({
  state,
  showDiff = true,
  id,
}: {
  state: PasswordRuleState
  /** Drop the "differs from current" row on screens with no current password. */
  showDiff?: boolean
  id?: string
}) {
  return (
    <ul id={id} className="pw-reqs">
      {RULES.filter((r) => showDiff || r.key !== 'diff').map((rule) => {
        const ok = state[rule.key]
        return (
          <li
            key={rule.key}
            className={`pw-req ${ok ? 'pw-req-ok' : ''} ${rule.wide ? 'sm:col-span-2' : ''}`.trim()}
          >
            {ok ? (
              <svg
                aria-hidden="true"
                className="pw-req-ico"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                className="pw-req-ico"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="9" />
              </svg>
            )}
            <span>{rule.text}</span>
            <span className="sr-only">{ok ? ' ผ่านแล้ว' : ' ยังไม่ผ่าน'}</span>
          </li>
        )
      })}
    </ul>
  )
}

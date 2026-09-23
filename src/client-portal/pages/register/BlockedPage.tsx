import { StatusCard } from '@/client-portal/components/feedback/StatusCard'
import { LIcon } from '@/client-portal/icons/LucideIcon'

/**
 * `#/blocked` — the one terminal state on the client side. Prototype 750–784.
 *
 * ── 🔴 NO ACTION, ON PURPOSE — AND THAT IS THE HARD PART OF THIS SCREEN ──
 * `ALLOWED_SCREENS.blocked` is `['blocked']`: there is no second screen this access may reach, so
 * every button that could be drawn here would be a button that goes nowhere. A "ลองใหม่อีกครั้ง"
 * would re-run the checks and land the reader back on this exact screen, which teaches them the
 * app is broken rather than that a person has to be spoken to. The copy carries the only real
 * next step — contact the staff — and it is text because that is what it is.
 *
 * ⚠️ `StatusCard` renders no action row at all when `actions` is omitted, so the card ends on the
 * sentence. Passing an empty fragment instead would leave a `mt-6` gap under the copy.
 *
 * ── ⚠️ `ban`, AND IT IS THE ONLY PLACE IT IS ALLOWED ──
 * `licon.ts` reserves `circleX` for "this span cannot be requested" and says `ban` reads as *you
 * are forbidden* — which is precisely the message here, and nowhere else in the portal.
 *
 * ⚠️ `announce` IS ON. The reader arrives from a splash with no warning, the outcome is
 * irreversible from their side, and it is the one client screen where being told immediately is
 * worth interrupting for.
 */
export function BlockedPage() {
  return (
    <StatusCard
      tone="error"
      announce
      icon={<LIcon name="ban" className="h-7 w-7" />}
      title="บัญชีของคุณถูกระงับการใช้งาน"
      description="ขออภัยในความไม่สะดวก บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อเจ้าหน้าที่เพื่อตรวจสอบข้อมูล"
    />
  )
}

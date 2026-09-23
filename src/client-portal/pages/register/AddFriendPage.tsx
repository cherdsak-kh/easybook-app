import { StatusCard } from '@/client-portal/components/feedback/StatusCard'
import { useGate } from '@/client-portal/hooks/gate-context'

/**
 * `#/add-friend` — add the Official Account, then look again. Prototype 544–576.
 *
 * ── 🔴 THE QR KEEPS A LITERAL WHITE PLATE IN BOTH THEMES ──
 * `bg-white` is a hard-coded colour on a screen whose every other surface is a semantic token, and
 * it is the second functional exception in the portal after the logo. A camera reads a QR code by
 * the contrast between its modules and its quiet zone; invert that and the code stops scanning —
 * so a dark-theme `bg-base-100` here would not be a styling preference, it would be a screen that
 * cannot do the one thing it exists for. The `border-base-300` around it is what keeps the white
 * plate from floating in the dark theme.
 *
 * ── ⚠️ WHY THE HINT IS TIED TO `attempts` AND NOT TO A CLICK ──
 * The prototype's re-check button just reveals the hint (5630), because it has nothing to check.
 * Here the button runs the real four checks, and while they run `GateGuard` shows the splash — so
 * this component unmounts and comes back with fresh state, and a `useState` flag set by the click
 * would not survive to see the answer. `attempts > 0` is the durable form of the same fact: the
 * checks have run again and *still* concluded `not-friend`, which is exactly what the sentence
 * says. Arriving here for the first time shows the instructions without the reproach.
 *
 * ⚠️ `role="alert"` is on the HINT, not on the card (`announce` stays off). The card is neutral —
 * it is a set of instructions — while the hint is a result, and it appears after the reader has
 * already looked away at their phone's camera.
 */
export function AddFriendPage() {
  const { recheck, attempts } = useGate()

  return (
    <StatusCard
      title="เพิ่มเพื่อน EasyBook บน LINE"
      description="เพื่อดำเนินการต่อ โปรดเพิ่มบัญชีทางการของเราเป็นเพื่อน โดยสแกนคิวอาร์โค้ดด้านล่างผ่านแอปพลิเคชัน LINE"
      actions={
        <button type="button" onClick={recheck} className="btn btn-app btn-primary w-full">
          ตรวจสอบสถานะการเพิ่มเพื่อน
        </button>
      }
    >
      {/* `width`/`height` match the rendered 176px box so the card does not reflow around the
          image as it decodes — the one element on this screen with an intrinsic size. */}
      <img
        src="/line-oa-qrcode/QR_283iinva.png"
        alt="คิวอาร์โค้ดสำหรับเพิ่มเพื่อนบัญชีทางการ EasyBook"
        width={176}
        height={176}
        className="mx-auto mt-6 h-44 w-44 rounded-box border border-base-300 bg-white p-2"
      />

      {/* `text-start` inside a `text-center` card: instructions are read line by line, and centred
          list items make the eye hunt for where each one begins. */}
      <ol className="mt-6 list-decimal space-y-1.5 ps-5 text-start text-base-content/70">
        <li>เปิดแอปพลิเคชัน LINE และเลือกตัวสแกนคิวอาร์โค้ด</li>
        <li>สแกนคิวอาร์โค้ดด้านบน และกดเพิ่มเพื่อน EasyBook</li>
        <li>กลับมาที่หน้านี้ และกดปุ่มด้านล่าง</li>
      </ol>

      {attempts > 0 ? (
        <p className="mt-4 font-medium" role="alert">
          ระบบยังไม่พบสถานะการเพิ่มเพื่อน โปรดเพิ่มบัญชีทางการ EasyBook แล้วลองใหม่อีกครั้ง
        </p>
      ) : null}
    </StatusCard>
  )
}

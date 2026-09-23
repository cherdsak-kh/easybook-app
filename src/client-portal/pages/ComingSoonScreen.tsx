import { UnderConstruction } from '@/client-portal/components/feedback/UnderConstruction'

/**
 * The stand-in for a route that exists in the table but not yet in the product.
 *
 * Phase 2 owns the shell, the gate and the twenty ROUTES — not the twenty screens. Eighteen of
 * them are built in Phases 3–6, and until then each still needs an element, for two reasons that
 * are both about this phase rather than about the screens: `ALLOWED_SCREENS` cannot be verified
 * against a route that renders nothing, and the exit gate asks for zero console errors *on every
 * route*.
 *
 * ⚠️ THIS IS SCAFFOLDING AND IT IS EXPECTED TO SHRINK. Each phase deletes its own rows from the
 * table in `ClientRoutes.tsx`; the file goes when the last one does. It is the same device the
 * back-office uses for its 24 undesigned destinations (`ComingSoonPage`), and it exists here for
 * the same reason: "which of these are actually built?" should be answerable from one object.
 *
 * ⚠️ NOT A NEW DESIGN. It renders the prototype's own under-construction card, unchanged. The
 * one thing it adds is the frame — centred, safe-area padded — because `UnderConstruction` is a
 * card that expects a screen around it and here there is no screen yet.
 */
export function ComingSoonScreen({
  backTo,
  backLabel,
}: {
  backTo: string
  backLabel: string
}) {
  return (
    <div className="pad-safe grid min-h-dvh place-items-center">
      <div className="w-full max-w-sm">
        <UnderConstruction backTo={backTo} backLabel={backLabel} />
      </div>
    </div>
  )
}

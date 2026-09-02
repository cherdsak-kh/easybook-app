import type { ReactNode } from 'react'

/**
 * The centred, full-screen outcome card. Seven screens are this component with different words:
 * gate error (502), login (520), add-friend (544), pending (706), rejected (729), blocked (750),
 * and request-sent (1458).
 *
 * ── Why every one of these is centred ──
 * The same reasoning that banned `modal-bottom` (`DECISIONS.md` §3.5): the bottom of a phone is
 * contested by the home indicator, a collapsing URL bar, LINE's toolbar and the keyboard. These
 * screens have one action and it must be reachable, so `grid min-h-dvh place-items-center` puts
 * the whole card in the part of the screen nobody else wants.
 *
 * ── `max-w-sm`, and the shadow is load-bearing ──
 * The page sits on `base-200` and the card on `base-100`. In the light theme those two are 1.05
 * apart in luminance, so the SHADOW is the only thing making the card a card. Removing
 * `shadow-sm` does not flatten it — it makes it disappear.
 *
 * ⚠️ `role="alert"` IS OPT-IN, VIA `announce`. It interrupts a screen reader immediately, which
 * is right for "verification failed" and wrong for "welcome, sign in with LINE" — an assertive
 * region that fires on every neutral screen trains people to ignore the one that matters.
 */

/** Which semantic colour the icon medallion takes. `none` renders no medallion at all. */
export type StatusTone = 'error' | 'warning' | 'success' | 'info' | 'neutral' | 'none'

const MEDALLION: Record<Exclude<StatusTone, 'none'>, string> = {
  error: 'bg-error text-error-content',
  warning: 'bg-warning text-warning-content',
  success: 'bg-success text-success-content',
  info: 'bg-info text-info-content',
  /* `base-200` + a dimmed foreground: the "nothing has gone wrong, this is just information"
     medallion. Used by the under-construction card. */
  neutral: 'bg-base-200 text-base-content/60',
}

export function StatusCard({
  tone = 'none',
  icon,
  title,
  description,
  announce = false,
  children,
  actions,
}: {
  tone?: StatusTone
  /** The glyph inside the medallion. Sized by the caller — the prototype uses `h-7 w-7`. */
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  /** `true` on failure screens only. Wires `role="alert"`; see the note above. */
  announce?: boolean
  /** Anything between the description and the actions — a summary list, a reason panel. */
  children?: ReactNode
  /** The buttons. One filled CTA per screen; `#/blocked` deliberately passes none. */
  actions?: ReactNode
}) {
  return (
    <section className="pad-safe grid min-h-dvh place-items-center">
      <div className="w-full max-w-sm">
        <div className="card bg-base-100 shadow-sm">
          <div
            className="card-body p-6 text-center text-base"
            {...(announce ? { role: 'alert' } : {})}
          >
            {tone !== 'none' && icon ? (
              <span
                aria-hidden="true"
                className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${MEDALLION[tone]}`}
              >
                {icon}
              </span>
            ) : null}

            {/* `mt-4` only when a medallion sits above it, so a card without one does not open
                with a gap that has nothing in it. */}
            <h1
              className={`text-xl font-semibold ${tone !== 'none' && icon ? 'mt-4' : ''}`.trim()}
            >
              {title}
            </h1>
            {description ? <p className="mt-1 text-base-content/70">{description}</p> : null}

            {children}

            {actions ? <div className="mt-6 flex gap-3">{actions}</div> : null}
          </div>
        </div>
      </div>
    </section>
  )
}

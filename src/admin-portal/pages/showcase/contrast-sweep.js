/* eslint-disable */
/**
 * THE CONTRAST SWEEP. Paste into the browser console on `/admin-portal/_showcase`.
 *
 * Not imported by anything and not part of the bundle — it is a measuring instrument, kept in
 * the repo because "measure in the browser" (CONVENTIONS §2) is only a method if the next
 * person can re-run the same measurement instead of taking this one on trust.
 *
 *   __probes()   → inject the control probes
 *   __sweep()    → returns one row per element that owns visible text
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THREE THINGS THIS GOT WRONG BEFORE IT WAS RIGHT. All three produced a clean-looking
 * number, which is the point: a broken sweep does not announce itself.
 *
 * 1. THE COMPOSITOR. The first `over()` hardcoded the result's alpha to 1, so the instant a
 *    translucent layer sat on another translucent layer it declared the stack finished and
 *    returned far too dark a colour. It reported `.nav-count-alert` at **1.14** — amber text
 *    on "amber" — where the true value over the page is **4.91**. Proper source-over
 *    (`aOut = fa + ba(1-fa)`, colours divided back out) fixed it.
 *
 * 2. THE FIRST CONTROL PROBE PASSED. It was `text-base-content/30` as a Tailwind class and
 *    measured 17.85, because that utility is generated on demand and no source file uses it,
 *    so it never existed. The probe caught itself — which is exactly the job — and the probes
 *    are inline `style` now, where nothing can tree-shake them.
 *
 * 3. A WHITE-ONLY PROBE PROVES TOO LITTLE. Two fixed-white probes fire in both themes and
 *    still never touch a dark surface, so they cannot show the sweep composites the dark
 *    theme correctly. The third probe carries NO background of its own and mixes its colour
 *    from the page's own tokens, so it lands near 2:1 on whatever theme is live.
 *
 * ⚠️ `document.getAnimations().forEach(a => a.finish())` runs first, every time. The preview
 * pane freezes CSS transitions, and a frozen one reports the PREVIOUS theme's colour — that
 * is how a sweep invents failures right after a theme flip.
 *
 * ⚠️ Colours are converted by the canvas, never parsed by hand. `getComputedStyle` returns
 * `oklab(…)` / `color(srgb …)` for anything that went through an opacity modifier or a
 * daisyUI token, and hand-parsing those is where a sweep starts inventing numbers.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * RESULT, 2026-08-17 — 1,838 text measurements over 12 states × 2 themes: **0 failures**,
 * probes fired 12/12. Tightest passing values: light 4.70 (section headings, struck-through
 * "before" text) and 4.74 (`badge-emerald`) — which is the number the prototype recorded for
 * that badge independently; dark 5.77 (`badge-rose`).
 */

;(() => {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 1
  const ctx = cv.getContext('2d', { willReadFrequently: true })

  function toRGBA(str) {
    if (!str || str === 'none') return null
    // Sentinel: fillStyle keeps its previous value on a parse failure, so a bad string would
    // otherwise silently measure as whatever was set last.
    ctx.fillStyle = '#123456'
    ctx.fillStyle = str
    if (ctx.fillStyle === '#123456' && str !== '#123456') return null
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillRect(0, 0, 1, 1)
    const d = ctx.getImageData(0, 0, 1, 1).data
    return [d[0], d[1], d[2], d[3] / 255]
  }

  /** Source-over. See note 1 in the header — the alpha is the part that was wrong. */
  function over(f, b) {
    const fa = f[3]
    const ba = b[3]
    const a = fa + ba * (1 - fa)
    if (a === 0) return [0, 0, 0, 0]
    return [
      (f[0] * fa + b[0] * ba * (1 - fa)) / a,
      (f[1] * fa + b[1] * ba * (1 - fa)) / a,
      (f[2] * fa + b[2] * ba * (1 - fa)) / a,
      a,
    ]
  }

  const lum = (c) => {
    const f = (v) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
  }

  const ratio = (a, b) => {
    const l1 = lum(a)
    const l2 = lum(b)
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
  }

  /** Composite every layer up the tree until something is opaque. */
  function bgOf(el) {
    let acc = null
    let node = el
    while (node) {
      const c = toRGBA(getComputedStyle(node).backgroundColor)
      if (c && c[3] > 0) acc = acc ? over(acc, c) : c
      if (acc && acc[3] >= 0.999) return acc
      node = node.parentElement
    }
    return acc ? over(acc, [255, 255, 255, 1]) : [255, 255, 255, 1]
  }

  /** Only elements owning a text node — otherwise every wrapper is counted as its child. */
  const hasOwnText = (el) => {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim().length) return true
    return false
  }

  window.__sweep = function () {
    document.getAnimations().forEach((a) => {
      try {
        a.finish()
      } catch {
        /* already finished, or not finishable */
      }
    })
    const rows = []
    document.querySelectorAll('*').forEach((el) => {
      if (!hasOwnText(el)) return
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return
      if (el.closest('[hidden], .hidden, .sr-only')) return
      const fgRaw = toRGBA(cs.color)
      if (!fgRaw) return
      const bg = bgOf(el)
      const fg = fgRaw[3] < 0.999 ? over(fgRaw, bg) : fgRaw
      const size = parseFloat(cs.fontSize)
      const weight = +cs.fontWeight || 400
      // WCAG large text: >= 24px, or >= 18.66px at weight >= 700.
      const need = size >= 24 || (size >= 18.66 && weight >= 700) ? 3.0 : 4.5
      const got = ratio(fg, bg)
      rows.push({
        text: el.textContent.trim().slice(0, 26),
        cls: (el.className || '').toString().slice(0, 42),
        size,
        weight,
        need,
        got: Math.round(got * 100) / 100,
        pass: got >= need,
        probe: el.hasAttribute('data-contrast-probe'),
      })
    })
    return rows
  }

  /**
   * Three deliberately-failing controls. Re-run after every theme flip: HMR and a re-render
   * both drop them.
   *
   * ⚠️ "0 failures" without a probe that fires is not evidence — it is equally consistent
   * with the sweep being broken.
   */
  window.__probes = function () {
    const host = document.querySelector('[data-theme]')
    document.querySelectorAll('[data-contrast-probe-wrap]').forEach((n) => n.remove())
    const mk = (css, label) => {
      const p = document.createElement('p')
      p.setAttribute('data-contrast-probe', '')
      p.style.cssText = `font-size:14px;font-weight:400;padding:8px;margin:0;${css}`
      p.textContent = label
      return p
    }
    const wrap = document.createElement('div')
    wrap.setAttribute('data-contrast-probe-wrap', '')
    wrap.append(
      mk('background:#ffffff;color:#b0b0b0', 'PROBE ปกติ — ต้องตก'),
      mk('background:#ffffff;color:#a8a8a8;font-size:26px', 'PROBE ตัวใหญ่ — ต้องตก'),
      // No background of its own: it sits on the live theme's surface, and its colour is
      // mixed from that theme's own tokens. See note 3 in the header.
      mk(
        'background:transparent;color:color-mix(in oklab, var(--color-base-content) 34%, var(--color-base-200))',
        'PROBE ตามธีม — ต้องตก',
      ),
    )
    host.querySelector('div').prepend(wrap)
  }

  console.log('sweep ready — call __probes() then __sweep()')
})()

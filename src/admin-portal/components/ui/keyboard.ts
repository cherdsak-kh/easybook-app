/**
 * What the MOBILE KEYBOARD may do — predictive text, autocorrect, the personal
 * text-replacement dictionary, capitalisation.
 *
 * ⚠️ THIS IS A DIFFERENT QUESTION FROM `autocomplete`, and conflating the two is what this module
 * exists to stop. `autocomplete` says what the BROWSER or password manager may fill in; the four
 * attributes here say what the KEYBOARD may do while a human types. They were being decided by one
 * attribute, and the failure ran one way only: several fields hold somebody ELSE's details, so
 * `autocomplete="off"` is right there — a semantic token would autofill the operator's own name —
 * but on mobile that same attribute can take prediction down with it (Chrome/Android maps it to
 * no-personalised-learning, iOS suppresses the QuickType bar). Stating the keyboard half explicitly
 * means `autocomplete="off"` can never again silently mean "no suggestions".
 *
 * The rule is one line: **autocorrect is OFF only where the value is not a word.** Email, phone,
 * password, number. Everywhere else the field holds a Thai name or Thai prose, which is exactly
 * where prediction and text replacement save the most typing on a phone.
 *
 * ⚠️ `spellCheck` is not cosmetic here — Safari ties autocorrection to it, so `spellCheck={false}`
 * on a prose field would disable the very thing this is turning on. It is `false` only on the
 * machine-shaped fields, where autocorrect is off anyway.
 *
 * ⚠️ ITS OWN MODULE, not a second export from `FormField`. oxlint's `only-export-components` is
 * not a style preference: a file that exports a component AND a function loses Fast Refresh for
 * everything in it. `nav-icons.tsx` keeps its path table unexported for the same reason.
 */

import type { InputHTMLAttributes } from 'react'

const MACHINE_TYPES = new Set(['email', 'tel', 'url', 'number', 'password'])
const MACHINE_MODES = new Set(['email', 'tel', 'numeric', 'decimal', 'url'])

export type KeyboardAttrs = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  'autoCorrect' | 'autoCapitalize' | 'spellCheck' | 'enterKeyHint'
>

export function keyboardDefaults(type?: string, inputMode?: string): KeyboardAttrs {
  if (MACHINE_TYPES.has(type ?? '') || MACHINE_MODES.has(inputMode ?? '')) {
    return { autoCorrect: 'off', autoCapitalize: 'none', spellCheck: false }
  }
  if (type === 'search') {
    // `enterKeyHint` is safe to default only here, because a search box has exactly one thing
    // Enter can mean. Everywhere else it is next/done/go depending on the field's place in its
    // form, which this function cannot know — those are set at the call site.
    return { autoCorrect: 'on', autoCapitalize: 'none', spellCheck: true, enterKeyHint: 'search' }
  }
  return { autoCorrect: 'on', autoCapitalize: 'sentences', spellCheck: true }
}

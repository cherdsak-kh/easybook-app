/**
 * The error banner inside a form or modal — `__setAlert` in the prototype.
 *
 * ⚠️ ALWAYS RENDERED, hidden when empty, never mounted on demand. An assistive technology
 * announces a live region only if it already existed when the text arrived; a `role="alert"`
 * element created at the same moment as its message is silent. This is the same rule that
 * governs `FormField`'s error paragraph, `#login-alert` and `#dm-alert`.
 *
 * That is why `message` is `string | null` rather than the caller writing
 * `{error && <InlineAlert…>}` — the conditional render is exactly the bug.
 */

export function InlineAlert({
  message,
  className = '',
  id,
}: {
  message: string | null | undefined
  className?: string
  id?: string
}) {
  return (
    <div
      id={id}
      role="alert"
      className={`inline-alert ${message ? '' : 'hidden'} ${className}`.trim()}
    >
      <svg
        aria-hidden="true"
        className="inline-alert-ico"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
        />
      </svg>
      <p className="m-0">{message}</p>
    </div>
  )
}

/**
 * The quiet sibling — context an operator should read, not a failure.
 *
 * It carries NO `role`. A note that announces itself interrupts to say something that was
 * never urgent, and the fastest way to teach someone to ignore alerts is to fire one at them
 * for a footnote.
 */
export function InlineNote({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`inline-note ${className}`.trim()}>
      <svg
        aria-hidden="true"
        className="inline-note-ico"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
        />
      </svg>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

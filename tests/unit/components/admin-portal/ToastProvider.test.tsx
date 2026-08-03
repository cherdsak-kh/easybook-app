import { act, render, screen, waitFor } from '@testing-library/react'
import { ToastProvider } from '@/components/admin-portal/ToastProvider'
import { useToast } from '@/components/admin-portal/useToast'
import {
  TOAST_STACK_LIMIT,
  TOAST_TIMEOUT_MS,
  type ToastTone,
} from '@/components/admin-portal/toast-context'
import { TOAST_STRINGS } from '@/constants/ui-strings-toast'

/**
 * A minimal consumer. Every button fires one toast, so a test can drive the queue without
 * standing up a whole page.
 */
function Harness({ messages }: { readonly messages: readonly [string, ToastTone?][] }) {
  const { show } = useToast()
  return (
    <>
      {messages.map(([message, tone], i) => (
        <button key={i} type="button" onClick={() => show(message, tone)}>
          fire-{i}
        </button>
      ))}
    </>
  )
}

function renderHarness(messages: readonly [string, ToastTone?][]) {
  return render(
    <ToastProvider>
      <Harness messages={messages} />
    </ToastProvider>,
  )
}

const fire = (i = 0) => act(() => screen.getByText(`fire-${i}`).click())

describe('ToastProvider — daisyUI structure and position', () => {
  it('renders nothing until a toast is queued (no empty fixed container)', () => {
    const { container } = renderHarness([['ok']])
    expect(container.querySelector('.toast')).toBeNull()
  })

  it('wraps each message in a daisyUI `toast` → `alert` pair', () => {
    const { container } = renderHarness([['บันทึกเรียบร้อย']])
    fire()

    const wrapper = container.querySelector('.toast')!
    expect(wrapper).not.toBeNull()
    const alert = screen.getByText('บันทึกเรียบร้อย').closest('.alert')!
    expect(wrapper).toContainElement(alert as HTMLElement)
  })

  it('pins EVERY toast to the top-center (PO decision OPEN-8)', () => {
    const { container } = renderHarness([['a'], ['b', 'error']])
    fire(0)
    fire(1)

    // ONE container, `toast-center toast-top`, and never the old bottom placement.
    const wrappers = container.querySelectorAll('.toast')
    expect(wrappers).toHaveLength(1)
    expect(wrappers[0]).toHaveClass('toast', 'toast-center', 'toast-top')
    expect(wrappers[0]).not.toHaveClass('toast-bottom')
    expect(wrappers[0]).not.toHaveClass('toast-start')
    // Guards the top-right → top-center move from silently regressing.
    expect(wrappers[0]).not.toHaveClass('toast-end')
  })

  it.each([
    ['success', 'alert-success'],
    ['error', 'alert-error'],
    ['info', 'alert-info'],
    ['warning', 'alert-warning'],
  ] as const)('maps the %s tone to the semantic %s token', (tone, expected) => {
    renderHarness([[`msg-${tone}`, tone]])
    fire()

    expect(screen.getByText(`msg-${tone}`).closest('.alert')).toHaveClass(expected)
  })

  it('defaults to the success tone when none is given', () => {
    renderHarness([['ok']])
    fire()

    expect(screen.getByText('ok').closest('.alert')).toHaveClass('alert-success')
  })
})

describe('ToastProvider — accessibility', () => {
  it('announces a success POLITELY, without hijacking focus', () => {
    renderHarness([['saved', 'success']])
    fire()

    const live = screen.getByText('saved').closest('[role="status"]')!
    expect(live).toHaveAttribute('aria-live', 'polite')
  })

  it('announces an error ASSERTIVELY — a failed write is worth interrupting for', () => {
    renderHarness([['boom', 'error']])
    fire()

    const live = screen.getByText('boom').closest('[role="alert"]')!
    expect(live).toHaveAttribute('aria-live', 'assertive')
    // …and it is NOT also a polite status region, which would double-announce.
    expect(screen.getByText('boom').closest('[role="status"]')).toBeNull()
  })

  it('gives every toast a LABELLED dismiss control', () => {
    renderHarness([['saved']])
    fire()

    const close = screen.getByRole('button', { name: TOAST_STRINGS.dismiss })
    expect(close).toHaveAttribute('type', 'button')
    // Keyboard users must be able to see where they are.
    expect(close.className).toMatch(/focus-visible:/)
  })
})

describe('ToastProvider — dismissal', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('auto-dismisses after the timeout', async () => {
    renderHarness([['saved']])
    fire()
    expect(screen.getByText('saved')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(TOAST_TIMEOUT_MS - 1))
    expect(screen.getByText('saved')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(2))
    await waitFor(() => expect(screen.queryByText('saved')).not.toBeInTheDocument())
  })

  it('dismisses immediately on the close button, and stays gone', async () => {
    renderHarness([['saved']])
    fire()

    act(() => screen.getByRole('button', { name: TOAST_STRINGS.dismiss }).click())
    expect(screen.queryByText('saved')).not.toBeInTheDocument()

    // The cleared timer must not resurrect or re-fire anything.
    act(() => vi.advanceTimersByTime(TOAST_TIMEOUT_MS * 2))
    expect(screen.queryByText('saved')).not.toBeInTheDocument()
  })

  it('each toast auto-dismisses on its OWN clock, not a shared one', async () => {
    renderHarness([['first'], ['second']])
    fire(0)
    act(() => vi.advanceTimersByTime(TOAST_TIMEOUT_MS / 2))
    fire(1)

    // Half a timeout later the first is gone and the second is still up.
    act(() => vi.advanceTimersByTime(TOAST_TIMEOUT_MS / 2 + 1))
    await waitFor(() => expect(screen.queryByText('first')).not.toBeInTheDocument())
    expect(screen.getByText('second')).toBeInTheDocument()
  })
})

describe('ToastProvider — stacking', () => {
  it('STACKS two toasts fired close together instead of replacing one with the other', () => {
    const { container } = renderHarness([['first'], ['second']])
    fire(0)
    fire(1)

    expect(screen.getByText('first')).toBeInTheDocument()
    expect(screen.getByText('second')).toBeInTheDocument()
    // One wrapper, two alerts, in fire order (newest at the bottom of the stack).
    const alerts = container.querySelectorAll('.toast .alert')
    expect(alerts).toHaveLength(2)
    expect(alerts[0]).toHaveTextContent('first')
    expect(alerts[1]).toHaveTextContent('second')
  })

  it('caps the stack, dropping the OLDEST so a burst cannot cover the viewport', () => {
    const messages = Array.from(
      { length: TOAST_STACK_LIMIT + 1 },
      (_, i) => [`m${i}`] as [string],
    )
    const { container } = renderHarness(messages)
    messages.forEach((_, i) => fire(i))

    expect(container.querySelectorAll('.toast .alert')).toHaveLength(TOAST_STACK_LIMIT)
    expect(screen.queryByText('m0')).not.toBeInTheDocument()
    expect(screen.getByText(`m${TOAST_STACK_LIMIT}`)).toBeInTheDocument()
  })
})

describe('useToast — provider contract', () => {
  it('THROWS outside a provider rather than silently swallowing the notification', () => {
    // A no-op default would turn "nobody mounted the provider" into "the confirmation
    // never appears", which is the exact silent failure this project bans.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Harness messages={[['x']]} />)).toThrow(/ToastProvider/)
    spy.mockRestore()
  })
})

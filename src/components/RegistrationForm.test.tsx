import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ID_COUNT, RegistrationForm, type RegistrationFormValues } from '@/components/RegistrationForm'
import { UI_STRINGS_CLIENT as UI } from '@/constants/ui-strings-client'
import type { RegistrationOptions } from '@/lib/api-client'

/**
 * Derived from the component's own rule, not a hardcoded 13-char literal: if
 * `ID_COUNT` changes, this fixture stays valid instead of silently failing
 * validation and blocking every submit assertion below.
 */
const VALID_STAFF_ID = '6'.repeat(ID_COUNT)

const OPTIONS: RegistrationOptions = {
  departments: [
    { id: 1, name: 'Computer Science' },
    { id: 2, name: 'Mathematics' },
  ],
  personnelRoles: [
    { id: 10, name: 'Teacher' },
    { id: 11, name: 'Support Staff' },
  ],
}

// `RegistrationFormValues` holds the raw <select> strings — the stringified
// integer option ids — which the form parses back to numbers on submit.
const INITIAL: RegistrationFormValues = {
  firstName: 'Somchai',
  lastName: 'Jaidee',
  staffId: VALID_STAFF_ID,
  phone: '0812345678',
  departmentId: '1',
  personnelRoleId: '10',
}

function setup(props: Partial<React.ComponentProps<typeof RegistrationForm>> = {}) {
  const onSubmit = vi.fn()
  const loadOptions = props.loadOptions ?? vi.fn().mockResolvedValue(OPTIONS)
  render(
    <RegistrationForm
      mode="create"
      loadOptions={loadOptions}
      onSubmit={onSubmit}
      submitting={false}
      serverError={null}
      {...props}
    />,
  )
  return { onSubmit, loadOptions }
}

function fillIdentity() {
  fireEvent.change(screen.getByLabelText(UI.registration.firstName), { target: { value: 'Somchai' } })
  fireEvent.change(screen.getByLabelText(UI.registration.lastName), { target: { value: 'Jaidee' } })
  fireEvent.change(screen.getByLabelText(UI.registration.staffId), { target: { value: VALID_STAFF_ID } })
  fireEvent.change(screen.getByLabelText(UI.registration.phone), { target: { value: '0812345678' } })
}

describe('RegistrationForm — dynamic options', () => {
  it('shows a loading state, then populates the dropdowns from the fetched options', async () => {
    let resolveOpts: (o: RegistrationOptions) => void = () => {}
    const loadOptions = vi.fn().mockReturnValue(
      new Promise<RegistrationOptions>((r) => {
        resolveOpts = r
      }),
    )
    setup({ loadOptions })

    expect(screen.getByTestId('options-loading')).toBeInTheDocument()

    resolveOpts(OPTIONS)
    const dept = (await screen.findByLabelText(UI.registration.department)) as HTMLSelectElement
    expect(within(dept).getByRole('option', { name: 'Computer Science' })).toBeInTheDocument()
    expect(within(dept).getByRole('option', { name: 'Mathematics' })).toBeInTheDocument()
    const roleSel = screen.getByLabelText(UI.registration.personnelRole) as HTMLSelectElement
    expect(within(roleSel).getByRole('option', { name: 'Teacher' })).toBeInTheDocument()
    // No "student" wording remains anywhere in the form. A DELIBERATE ANCHOR:
    // a negative assertion cannot be derived from the dictionary without going
    // vacuous — the literal is the requirement (these users are staff, not
    // students). Precedent: `routes.test.ts`.
    expect(screen.queryByText(/student/i)).not.toBeInTheDocument()
  })

  it('surfaces a fetch error and retries on demand', async () => {
    const loadOptions = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(OPTIONS)
    setup({ loadOptions })

    expect(await screen.findByText(UI.registration.optionsError)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: UI.common.tryAgain }))

    expect(await screen.findByLabelText(UI.registration.department)).toBeInTheDocument()
    expect(loadOptions).toHaveBeenCalledTimes(2)
  })

  it('disables submit and warns when no options are configured', async () => {
    const loadOptions = vi
      .fn()
      .mockResolvedValue({ departments: [], personnelRoles: [] } satisfies RegistrationOptions)
    setup({ loadOptions })

    expect(await screen.findByText(UI.registration.noOptions)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: UI.registration.createSubmit })).toBeDisabled()
  })

  it('submits the id-based DTO with NUMERIC option ids once options are chosen', async () => {
    const { onSubmit } = setup()
    await screen.findByLabelText(UI.registration.department)

    fillIdentity()
    // <select> values are DOM strings; the form must coerce them to integers.
    fireEvent.change(screen.getByLabelText(UI.registration.department), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(UI.registration.personnelRole), { target: { value: '11' } })
    fireEvent.click(screen.getByRole('button', { name: UI.registration.createSubmit }))

    expect(onSubmit).toHaveBeenCalledWith({
      firstName: 'Somchai',
      lastName: 'Jaidee',
      staffId: VALID_STAFF_ID,
      phone: '0812345678',
      departmentId: 2,
      personnelRoleId: 11,
    })
  })

  it('blocks submit until a department and role are selected', async () => {
    const { onSubmit } = setup()
    await screen.findByLabelText(UI.registration.department)

    fillIdentity() // identity valid, but no options selected yet
    fireEvent.click(screen.getByRole('button', { name: UI.registration.createSubmit }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(UI.registration.departmentRequired)).toBeInTheDocument()
    expect(screen.getByText(UI.registration.personnelRoleRequired)).toBeInTheDocument()
  })
})

describe('RegistrationForm — edit mode', () => {
  it('pre-fills from initial values and can be cancelled', async () => {
    const onCancel = vi.fn()
    setup({ mode: 'edit', initial: INITIAL, onCancel })

    await screen.findByLabelText(UI.registration.department)
    expect(screen.getByLabelText(UI.registration.firstName)).toHaveValue('Somchai')
    expect(screen.getByLabelText(UI.registration.staffId)).toHaveValue(VALID_STAFF_ID)
    // The pre-filled numeric id ('1') keeps its option selected in the <select>.
    expect(screen.getByLabelText(UI.registration.department)).toHaveValue('1')
    expect(screen.getByRole('button', { name: UI.registration.editSubmit })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: UI.registration.cancel }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('emits edited values via onSubmit', async () => {
    const { onSubmit } = setup({ mode: 'edit', initial: INITIAL })
    await screen.findByLabelText(UI.registration.department)

    fireEvent.change(screen.getByLabelText(UI.registration.firstName), { target: { value: 'Somsak' } })
    fireEvent.click(screen.getByRole('button', { name: UI.registration.editSubmit }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Somsak' })),
    )
  })
})

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { RegistrationForm, type RegistrationFormValues } from '@/components/RegistrationForm'
import type { RegistrationOptions } from '@/lib/api-client'

const OPTIONS: RegistrationOptions = {
  departments: [
    { id: 'dept-cs', name: 'Computer Science' },
    { id: 'dept-math', name: 'Mathematics' },
  ],
  personnelRoles: [
    { id: 'role-teacher', name: 'Teacher' },
    { id: 'role-support', name: 'Support Staff' },
  ],
}

const INITIAL: RegistrationFormValues = {
  firstName: 'Somchai',
  lastName: 'Jaidee',
  staffId: '6412345678',
  phone: '081-234-5678',
  departmentId: 'dept-cs',
  personnelRoleId: 'role-teacher',
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
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Somchai' } })
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Jaidee' } })
  fireEvent.change(screen.getByLabelText('Staff ID'), { target: { value: '6412345678' } })
  fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '081-234-5678' } })
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
    const dept = (await screen.findByLabelText('Department')) as HTMLSelectElement
    expect(within(dept).getByRole('option', { name: 'Computer Science' })).toBeInTheDocument()
    expect(within(dept).getByRole('option', { name: 'Mathematics' })).toBeInTheDocument()
    const roleSel = screen.getByLabelText('Role') as HTMLSelectElement
    expect(within(roleSel).getByRole('option', { name: 'Teacher' })).toBeInTheDocument()
    // No "student" wording remains anywhere in the form.
    expect(screen.queryByText(/student/i)).not.toBeInTheDocument()
  })

  it('surfaces a fetch error and retries on demand', async () => {
    const loadOptions = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(OPTIONS)
    setup({ loadOptions })

    expect(
      await screen.findByText(/could not load the registration options/i),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByLabelText('Department')).toBeInTheDocument()
    expect(loadOptions).toHaveBeenCalledTimes(2)
  })

  it('disables submit and warns when no options are configured', async () => {
    const loadOptions = vi
      .fn()
      .mockResolvedValue({ departments: [], personnelRoles: [] } satisfies RegistrationOptions)
    setup({ loadOptions })

    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit registration/i })).toBeDisabled()
  })

  it('submits the id-based DTO once options are chosen', async () => {
    const { onSubmit } = setup()
    await screen.findByLabelText('Department')

    fillIdentity()
    fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'dept-math' } })
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'role-support' } })
    fireEvent.click(screen.getByRole('button', { name: /submit registration/i }))

    expect(onSubmit).toHaveBeenCalledWith({
      firstName: 'Somchai',
      lastName: 'Jaidee',
      staffId: '6412345678',
      phone: '081-234-5678',
      departmentId: 'dept-math',
      personnelRoleId: 'role-support',
    })
  })

  it('blocks submit until a department and role are selected', async () => {
    const { onSubmit } = setup()
    await screen.findByLabelText('Department')

    fillIdentity() // identity valid, but no options selected yet
    fireEvent.click(screen.getByRole('button', { name: /submit registration/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Please select a department.')).toBeInTheDocument()
    expect(screen.getByText('Please select a role.')).toBeInTheDocument()
  })
})

describe('RegistrationForm — edit mode', () => {
  it('pre-fills from initial values and can be cancelled', async () => {
    const onCancel = vi.fn()
    setup({ mode: 'edit', initial: INITIAL, onCancel })

    await screen.findByLabelText('Department')
    expect(screen.getByLabelText('First name')).toHaveValue('Somchai')
    expect(screen.getByLabelText('Staff ID')).toHaveValue('6412345678')
    expect(screen.getByLabelText('Department')).toHaveValue('dept-cs')
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('emits edited values via onSubmit', async () => {
    const { onSubmit } = setup({ mode: 'edit', initial: INITIAL })
    await screen.findByLabelText('Department')

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Somsak' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Somsak' })),
    )
  })
})

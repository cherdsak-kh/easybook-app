import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { RegistrationForm, type RegistrationFormValues } from '@/components/RegistrationForm'
import type { RegistrationOptions } from '@/lib/api-client'

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
  staffId: '6412345678901',
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
  fireEvent.change(screen.getByLabelText('ชื่อจริง'), { target: { value: 'Somchai' } })
  fireEvent.change(screen.getByLabelText('นามสกุล'), { target: { value: 'Jaidee' } })
  fireEvent.change(screen.getByLabelText('รหัสบุคลากร'), { target: { value: '6412345678901' } })
  fireEvent.change(screen.getByLabelText('เบอร์โทรศัพท์'), { target: { value: '0812345678' } })
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
    const dept = (await screen.findByLabelText('ฝ่าย / แผนก')) as HTMLSelectElement
    expect(within(dept).getByRole('option', { name: 'Computer Science' })).toBeInTheDocument()
    expect(within(dept).getByRole('option', { name: 'Mathematics' })).toBeInTheDocument()
    const roleSel = screen.getByLabelText('ตำแหน่ง / บทบาท') as HTMLSelectElement
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

    expect(await screen.findByLabelText('ฝ่าย / แผนก')).toBeInTheDocument()
    expect(loadOptions).toHaveBeenCalledTimes(2)
  })

  it('disables submit and warns when no options are configured', async () => {
    const loadOptions = vi
      .fn()
      .mockResolvedValue({ departments: [], personnelRoles: [] } satisfies RegistrationOptions)
    setup({ loadOptions })

    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ยืนยันการลงทะเบียน' })).toBeDisabled()
  })

  it('submits the id-based DTO with NUMERIC option ids once options are chosen', async () => {
    const { onSubmit } = setup()
    await screen.findByLabelText('ฝ่าย / แผนก')

    fillIdentity()
    // <select> values are DOM strings; the form must coerce them to integers.
    fireEvent.change(screen.getByLabelText('ฝ่าย / แผนก'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('ตำแหน่ง / บทบาท'), { target: { value: '11' } })
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันการลงทะเบียน' }))

    expect(onSubmit).toHaveBeenCalledWith({
      firstName: 'Somchai',
      lastName: 'Jaidee',
      staffId: '6412345678901',
      phone: '0812345678',
      departmentId: 2,
      personnelRoleId: 11,
    })
  })

  it('blocks submit until a department and role are selected', async () => {
    const { onSubmit } = setup()
    await screen.findByLabelText('ฝ่าย / แผนก')

    fillIdentity() // identity valid, but no options selected yet
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันการลงทะเบียน' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('โปรดเลือกฝ่าย/แผนก')).toBeInTheDocument()
    expect(screen.getByText('โปรดเลือกตำแหน่ง/บทบาท')).toBeInTheDocument()
  })
})

describe('RegistrationForm — edit mode', () => {
  it('pre-fills from initial values and can be cancelled', async () => {
    const onCancel = vi.fn()
    setup({ mode: 'edit', initial: INITIAL, onCancel })

    await screen.findByLabelText('ฝ่าย / แผนก')
    expect(screen.getByLabelText('ชื่อจริง')).toHaveValue('Somchai')
    expect(screen.getByLabelText('รหัสบุคลากร')).toHaveValue('6412345678901')
    // The pre-filled numeric id ('1') keeps its option selected in the <select>.
    expect(screen.getByLabelText('ฝ่าย / แผนก')).toHaveValue('1')
    expect(screen.getByRole('button', { name: 'บันทึกข้อมูล' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'ยกเลิก' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('emits edited values via onSubmit', async () => {
    const { onSubmit } = setup({ mode: 'edit', initial: INITIAL })
    await screen.findByLabelText('ฝ่าย / แผนก')

    fireEvent.change(screen.getByLabelText('ชื่อจริง'), { target: { value: 'Somsak' } })
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกข้อมูล' }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'Somsak' })),
    )
  })
})

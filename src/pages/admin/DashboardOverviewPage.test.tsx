import { render, screen, within } from '@testing-library/react'
import { DashboardOverviewPage } from '@/pages/admin/DashboardOverviewPage'

/**
 * Mock `react-chartjs-2` at the import boundary (repo convention) so the charts
 * render as inert stubs — jsdom has no real <canvas>, and the page's parity is
 * about structure/copy, not the pixels Chart.js paints. Each stub exposes its
 * dataset labels so the test can still prove the right chart got the right data.
 */
vi.mock('react-chartjs-2', () => {
  type StubProps = { data: { datasets: { label?: string }[] } }
  const stub = (testid: string) => (props: StubProps) => (
    <div data-testid={testid} data-series={props.data.datasets.map((d) => d.label ?? '').join(',')} />
  )
  return {
    Line: stub('line-chart'),
    Bar: stub('bar-chart'),
    Doughnut: stub('doughnut-chart'),
  }
})

describe('DashboardOverviewPage', () => {
  it('renders the four KPI stat cards with their values and deltas', () => {
    render(<DashboardOverviewPage />)

    expect(screen.getByText('New Users')).toBeInTheDocument()
    expect(screen.getByText('34.7k')).toBeInTheDocument()
    expect(screen.getByText('Total Sales')).toBeInTheDocument()
    expect(screen.getByText('$34,545')).toBeInTheDocument()
    expect(screen.getByText('Active Users')).toBeInTheDocument()
  })

  it('colours the up delta as success and the down delta as error', () => {
    render(<DashboardOverviewPage />)

    // Direction is carried by the glyph AND the colour token (not colour alone).
    expect(screen.getByText('↗︎ 2300 (22%)')).toHaveClass('text-success')
    expect(screen.getByText('↙ 300 (18%)')).toHaveClass('text-error')
  })

  it('renders the three charts, each fed its own frozen dataset', () => {
    render(<DashboardOverviewPage />)

    expect(screen.getByTestId('line-chart')).toHaveAttribute('data-series', 'MAU')
    expect(screen.getByTestId('bar-chart')).toHaveAttribute('data-series', 'Store 1,Store 2')
    expect(screen.getByTestId('doughnut-chart')).toHaveAttribute('data-series', '# of Orders')
  })

  it('renders the User Signup Source table with its rows', () => {
    render(<DashboardOverviewPage />)

    expect(screen.getByText('User Signup Source')).toBeInTheDocument()
    const table = screen.getByRole('table')
    expect(within(table).getByText('Facebook Ads')).toBeInTheDocument()
    expect(within(table).getByText('26,345')).toBeInTheDocument()
    expect(within(table).getByText('20.9%')).toBeInTheDocument()
  })

  it('renders the chart card titles (parity anchors)', () => {
    render(<DashboardOverviewPage />)

    expect(screen.getByText('Monthly Active Users (in K)')).toBeInTheDocument()
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('Orders by Category')).toBeInTheDocument()
  })

  it('renders the static top-bar controls without a datepicker dependency', () => {
    render(<DashboardOverviewPage />)

    // The read-only period field replaced the dropped datepicker.
    const period = screen.getByLabelText('Reporting period') as HTMLInputElement
    expect(period).toHaveAttribute('readonly')
    expect(screen.getByRole('button', { name: /Refresh Data/ })).toBeInTheDocument()
  })
})

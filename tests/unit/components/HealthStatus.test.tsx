import { render, screen } from '@testing-library/react'
import { HealthStatus } from '@/components/HealthStatus'
import * as apiClient from '@/lib/api-client'
import type { HealthResponse } from '@/lib/api-client'

// Mock the API client at the module boundary so no network is hit.
vi.mock('@/lib/api-client', () => ({
  getHealth: vi.fn(),
}))

const mockGetHealth = vi.mocked(apiClient.getHealth)

/** Build a HealthResponse, overriding only the fields a test cares about. */
function health(overrides: Partial<HealthResponse> = {}): HealthResponse {
  return {
    status: 'ok',
    uptime: 12.34,
    timestamp: '2026-06-29T00:00:00.000Z',
    db: 'up',
    redis: 'up',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('HealthStatus', () => {
  it('shows a loading message while the probe is in flight', () => {
    mockGetHealth.mockReturnValue(new Promise(() => {})) // never resolves
    render(<HealthStatus />)
    expect(screen.getByText(/Checking/)).toBeInTheDocument()
  })

  it('renders a healthy status and uptime when both dependencies are up (200)', async () => {
    mockGetHealth.mockResolvedValue(health({ status: 'ok', db: 'up', redis: 'up' }))
    render(<HealthStatus />)

    expect(await screen.findByText('Healthy')).toBeInTheDocument()
    expect(screen.getByText(/uptime/)).toBeInTheDocument()
    expect(screen.getByText(/12\.3/)).toBeInTheDocument()
    // Healthy is a non-urgent, polite status region.
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders a degraded warning naming the DB when the database is down (503)', async () => {
    // getHealth surfaces the 503 body (status:'error') rather than throwing.
    mockGetHealth.mockResolvedValue(
      health({ status: 'error', db: 'down', redis: 'up' }),
    )
    render(<HealthStatus />)

    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(screen.getByText('Degraded')).toBeInTheDocument()
    expect(screen.getByText(/Database unavailable/)).toBeInTheDocument()
    // Must not be mistaken for the healthy state.
    expect(screen.queryByText('Healthy')).not.toBeInTheDocument()
  })

  it('names Redis when only Redis is down (503)', async () => {
    mockGetHealth.mockResolvedValue(
      health({ status: 'error', db: 'up', redis: 'down' }),
    )
    render(<HealthStatus />)

    expect(await screen.findByText('Degraded')).toBeInTheDocument()
    expect(screen.getByText(/Redis unavailable/)).toBeInTheDocument()
  })

  it('reads "System Down" and names both deps when both are down (503)', async () => {
    mockGetHealth.mockResolvedValue(
      health({ status: 'error', db: 'down', redis: 'down' }),
    )
    render(<HealthStatus />)

    expect(await screen.findByText('System Down')).toBeInTheDocument()
    expect(screen.getByText(/Database and Redis unavailable/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('renders an unreachable message when the request fails entirely', async () => {
    mockGetHealth.mockRejectedValue(new Error('Request failed: /api/v1/health (502)'))
    render(<HealthStatus />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/Unreachable/)
    expect(screen.getByText(/502/)).toBeInTheDocument()
    // A network failure is distinct from a 503 degraded state.
    expect(screen.queryByText('Degraded')).not.toBeInTheDocument()
  })
})

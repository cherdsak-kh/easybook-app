import { render, screen } from '@testing-library/react'
import { HealthStatus } from '@/components/HealthStatus'
import * as apiClient from '@/lib/api-client'

// Mock the API client at the module boundary so no network is hit.
vi.mock('@/lib/api-client', () => ({
  getHealth: vi.fn(),
}))

const mockGetHealth = vi.mocked(apiClient.getHealth)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('HealthStatus', () => {
  it('shows a loading message while the probe is in flight', () => {
    mockGetHealth.mockReturnValue(new Promise(() => {})) // never resolves
    render(<HealthStatus />)
    expect(screen.getByText(/Checking/)).toBeInTheDocument()
  })

  it('renders the ok status and uptime when the backend responds', async () => {
    mockGetHealth.mockResolvedValue({
      status: 'ok',
      uptime: 12.34,
      timestamp: '2026-06-29T00:00:00.000Z',
      db: 'up',
    })
    render(<HealthStatus />)

    expect(await screen.findByText('ok')).toBeInTheDocument()
    expect(screen.getByText(/uptime/)).toBeInTheDocument()
    expect(screen.getByText(/12\.3/)).toBeInTheDocument()
  })

  it('renders an unreachable message when the probe fails', async () => {
    mockGetHealth.mockRejectedValue(new Error('Request failed: 502 Bad Gateway'))
    render(<HealthStatus />)

    expect(await screen.findByText(/Unreachable/)).toBeInTheDocument()
    expect(screen.getByText(/502 Bad Gateway/)).toBeInTheDocument()
  })
})

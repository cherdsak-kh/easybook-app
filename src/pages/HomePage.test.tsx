import { render, screen } from '@testing-library/react'
import { HomePage } from '@/pages/HomePage'
import * as liffLib from '@/lib/liff'

// Mock the LIFF wrapper so tests control the profile without the real SDK.
vi.mock('@/lib/liff', () => ({
  initLiff: vi.fn(),
}))

const mockInitLiff = vi.mocked(liffLib.initLiff)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('HomePage', () => {
  it('greets the world when there is no LIFF profile', async () => {
    mockInitLiff.mockResolvedValue(null)
    render(<HomePage />)
    expect(await screen.findByText(/Hello, World/)).toBeInTheDocument()
  })

  it('greets the LINE user by display name when a profile is present', async () => {
    mockInitLiff.mockResolvedValue({ displayName: 'Alice', userId: 'U123' })
    render(<HomePage />)
    expect(await screen.findByText(/Hello, Alice/)).toBeInTheDocument()
  })
})

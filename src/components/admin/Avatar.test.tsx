import { fireEvent, render, screen } from '@testing-library/react'
import { Avatar } from '@/components/admin/Avatar'
import { UI_STRINGS } from '@/constants/ui-strings-backend'

/**
 * `Avatar` is the single fallback implementation for every portal surface, so
 * its edge cases are asserted here once rather than re-proved in each page suite.
 * The page suites only assert that they WIRE it to the right data.
 */
describe('Avatar', () => {
  it('renders the picture when profilePictureUrl is present', () => {
    render(<Avatar src="https://cdn.example.com/a.jpg" name="Ada Lovelace" />)

    const img = screen.getByTestId<HTMLImageElement>('avatar-image')
    expect(img.src).toBe('https://cdn.example.com/a.jpg')
    expect(screen.queryByTestId('avatar-fallback')).not.toBeInTheDocument()
  })

  it('renders initials instead of a broken img when profilePictureUrl is null', () => {
    render(<Avatar src={null} name="Ada Lovelace" />)

    expect(screen.getByTestId('avatar-fallback')).toHaveTextContent('AL')
    // No <img> at all — not an <img> with an empty src, which browsers would
    // resolve against the page URL and re-request.
    expect(screen.queryByTestId('avatar-image')).not.toBeInTheDocument()
  })

  it('falls back to initials when the image 404s (onError)', () => {
    render(<Avatar src="https://cdn.example.com/gone.jpg" name="Ada Lovelace" />)

    const img = screen.getByTestId('avatar-image')
    expect(screen.queryByTestId('avatar-fallback')).not.toBeInTheDocument()

    // The R2 object went missing: a broken <img> in a table row looks terrible,
    // so the placeholder takes over.
    fireEvent.error(img)

    expect(screen.getByTestId('avatar-fallback')).toHaveTextContent('AL')
    expect(screen.queryByTestId('avatar-image')).not.toBeInTheDocument()
  })

  it('re-arms the img when src changes after a failure', () => {
    const { rerender } = render(<Avatar src="https://cdn.example.com/gone.jpg" name="Ada Lovelace" />)
    fireEvent.error(screen.getByTestId('avatar-image'))
    expect(screen.getByTestId('avatar-fallback')).toBeInTheDocument()

    // A fresh upload must display. Tracking WHICH src failed (not a boolean)
    // is what makes this work — a latched flag would hide the new picture.
    rerender(<Avatar src="https://cdn.example.com/new.jpg" name="Ada Lovelace" />)

    expect(screen.getByTestId<HTMLImageElement>('avatar-image').src).toBe(
      'https://cdn.example.com/new.jpg',
    )
    expect(screen.queryByTestId('avatar-fallback')).not.toBeInTheDocument()
  })

  it('keeps the fallback colour stable for the same key across renders', () => {
    const { rerender } = render(<Avatar src={null} name="Ada Lovelace" colorKey="u1" />)
    const first = screen.getByTestId('avatar-fallback').className

    // A re-render (or a rename) must not reshuffle the colour: it is a pure
    // function of colorKey, never random and never index-based.
    rerender(<Avatar src={null} name="Ada Byron" colorKey="u1" />)

    expect(screen.getByTestId('avatar-fallback').className).toBe(first)
  })

  it('gives different keys different colours', () => {
    const { unmount } = render(<Avatar src={null} name="Ada Lovelace" colorKey="u1" />)
    const a = screen.getByTestId('avatar-fallback').className
    unmount()

    render(<Avatar src={null} name="Bob Smith" colorKey="u2" />)
    expect(screen.getByTestId('avatar-fallback').className).not.toBe(a)
  })

  it('is circular and never distorts a non-square source', () => {
    render(<Avatar src="https://cdn.example.com/wide.jpg" name="Ada Lovelace" size="md" />)

    const img = screen.getByTestId('avatar-image')
    expect(img).toHaveClass('rounded-full', 'object-cover')
    // Fixed, equal width/height — the crop comes from object-cover, not squashing.
    expect(img).toHaveClass('h-10', 'w-10')
  })

  it('is decorative by default and named only when alt is given', () => {
    const { rerender } = render(<Avatar src={null} name="Ada Lovelace" />)
    // Nothing adjacent is being duplicated, so it stays out of the a11y tree.
    expect(screen.queryByRole('img')).not.toBeInTheDocument()

    // Hard-coded on purpose: `alt` is a PROP this test supplies, not copy the
    // component owns. Reaching for `UI_STRINGS.profile.avatarAlt` here would
    // couple Avatar's generic alt→role wiring to the profile page's wording.
    rerender(<Avatar src={null} name="Ada Lovelace" alt="Your profile picture" />)
    expect(screen.getByRole('img', { name: 'Your profile picture' })).toBeInTheDocument()
  })

  it('renders an empty alt (not a missing one) for a decorative picture', () => {
    render(<Avatar src="https://cdn.example.com/a.jpg" name="Ada Lovelace" />)

    // alt="" is what marks it decorative; omitting alt entirely would make
    // screen readers announce the filename.
    expect(screen.getByTestId('avatar-image')).toHaveAttribute('alt', '')
  })

  it('handles a single-word name and an empty name without crashing', () => {
    const { rerender } = render(<Avatar src={null} name="Cher" />)
    expect(screen.getByTestId('avatar-fallback')).toHaveTextContent('C')

    rerender(<Avatar src={null} name="   " />)
    expect(screen.getByTestId('avatar-fallback')).toHaveTextContent(
      UI_STRINGS.avatar.unknownInitials,
    )
  })
})

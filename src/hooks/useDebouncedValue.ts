import { useEffect, useState } from 'react'

/**
 * Returns a copy of `value` that only updates after it has stayed unchanged for
 * `delayMs`. Used to debounce the LINE Users search box so a keystroke doesn't
 * fire a request per character.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])

  return debounced
}

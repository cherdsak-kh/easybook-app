import { useEffect, useState } from 'react'
import { initLiff, type LiffProfile } from '@/lib/liff'

/**
 * Minimal LIFF index. Initialises LIFF on mount and greets the LINE user by
 * display name, falling back to "World" when run outside LINE / unconfigured.
 */
export function HomePage() {
  const [profile, setProfile] = useState<LiffProfile | null>(null)

  useEffect(() => {
    let active = true
    initLiff().then((p) => {
      if (active) setProfile(p)
    })
    return () => {
      active = false
    }
  }, [])

  const name = profile?.displayName ?? 'World'

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center dark:bg-slate-900">
      <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">
        Hello, {name} 👋
      </h1>
      <p className="mt-3 text-slate-500">easy-book-app — LIFF index (mock)</p>
    </main>
  )
}

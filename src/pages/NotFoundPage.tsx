/**
 * The app's single GLOBAL 404. It backs the one `path="*"` fallback in `App.tsx`, so ANY
 * unmatched URL lands here — the client portal's, `/admin-portal/*`, and anything mistyped.
 *
 * ⚠️ IT IS NOT THE BACK-OFFICE'S 404. A URL under `/backend` never reaches this: signed in,
 * an unmatched path gets the in-shell 404 with the menu still around it; signed OUT, it gets
 * the login form rather than a 404 at all — so an outsider cannot use 404-vs-login to ask
 * which back-office paths exist. That is the same rule the service applies to reserved
 * options, arrived at from the other side.
 *
 * The design is the prototype's full-page 404 (PO ruling, 17 ส.ค. 2569, replacing the ported
 * DashWind placeholder). This file is the thin wrapper that supplies what the component cannot
 * know: which URL missed, and where "home" is for an anonymous visitor.
 */

import { useLocation, useNavigate } from 'react-router-dom'
import { NotFound } from '@/components/shared/NotFound'

export function NotFoundPage() {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()

  return (
    <NotFound
      variant="full"
      // The search string is included because a stale link's query is often the whole reason
      // it is stale, and the operator reading this out over the phone needs the part that
      // differs from the working one.
      path={`${pathname}${search}`}
      onHome={() => void navigate('/')}
    />
  )
}

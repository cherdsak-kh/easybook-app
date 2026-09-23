import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
/* Noto Sans Thai — self-hosted (npm), NOT the Google Fonts CDN. Subset-scoped on
   purpose: only `thai` (all client + admin copy) and `latin` (brand name, emails,
   digits), only the four weights the codebase actually uses (400/500/600/700).
   The package ships three subsets — `thai`, `latin`, `latin-ext` — and nine weights,
   normal style only (there is no italic face to exclude, unlike Kanit).
   Never import the aggregate `@fontsource/noto-sans-thai/400.css` — it pulls every
   subset, i.e. `latin-ext` on top, which no copy in this product needs.
   Must stay ABOVE `@/index.css` so Tailwind/daisyUI keep winning the cascade. */
import '@fontsource/noto-sans-thai/thai-400.css'
import '@fontsource/noto-sans-thai/thai-500.css'
import '@fontsource/noto-sans-thai/thai-600.css'
import '@fontsource/noto-sans-thai/thai-700.css'
import '@fontsource/noto-sans-thai/latin-400.css'
import '@fontsource/noto-sans-thai/latin-500.css'
import '@fontsource/noto-sans-thai/latin-600.css'
import '@fontsource/noto-sans-thai/latin-700.css'
import '@/index.css'
import App from '@/App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
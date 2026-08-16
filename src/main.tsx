import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
/* Kanit — self-hosted (npm), NOT the Google Fonts CDN. Subset-scoped on purpose:
   only `thai` (all client + admin copy) and `latin` (brand name, emails, digits),
   only the four weights the codebase actually uses (400/500/600/700), upright only.
   Never import the aggregate `@fontsource/kanit/400.css` — it pulls every subset.
   Must stay ABOVE `@/index.css` so Tailwind/daisyUI keep winning the cascade. */
import '@fontsource/kanit/thai-400.css'
import '@fontsource/kanit/thai-500.css'
import '@fontsource/kanit/thai-600.css'
import '@fontsource/kanit/thai-700.css'
import '@fontsource/kanit/latin-400.css'
import '@fontsource/kanit/latin-500.css'
import '@fontsource/kanit/latin-600.css'
import '@fontsource/kanit/latin-700.css'
import '@/index.css'
import App from '@/App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
# Third-party notices

This project includes work adapted from third-party open-source software. The
original licenses and copyright notices are reproduced below, as required.

---

## DashWind — daisyui-admin-dashboard-template

- **Project:** DashWind (daisyui-admin-dashboard-template)
- **Source:** https://github.com/robbins23/daisyui-admin-dashboard-template
- **License:** MIT
- **Used in:**
  - The admin dashboard **shell** — the JSX structure and daisyUI class layout of
    `src/components/admin/DashboardLayout.tsx`, `src/components/admin/Sidebar.tsx`
    and `src/components/admin/Header.tsx` were adapted from the template's
    `src/containers/*`. No template Redux, theming, routing, notifications, auth or
    API logic were copied; those are our own.
  - The admin **Dashboard Overview** page (`src/pages/admin/DashboardOverviewPage.tsx`)
    and its components under `src/components/dashboard/*` (`TitleCard`, `StatCard`,
    `AmountStats`, `PageStats`, `UserChannels`, `LineChart`, `BarChart`,
    `DoughnutChart`, `DashboardTopBar`), adapted from the template's
    `src/features/dashboard/*` and `src/components/Cards/TitleCard.js`. The demo
    mock data and Chart.js dataset/component structure were adapted into our own
    typed `src/components/dashboard/dashboard-mock-data.ts` (randomized series
    frozen to fixed literals). Redux and the `react-tailwindcss-datepicker` demo
    control were stripped; `dark:` utilities were replaced with our daisyUI
    semantic tokens; chart theming, routing and copy handling are our own.
  - The isolated DashWind **replica** at `/admin-portal` — `src/pages/admin-portal/*`
    and `src/components/admin-portal/*` (shell `AdminPortalLayout` / `AdminPortalSidebar`
    / `AdminPortalHeader`, `SidebarSubmenu`, `AdminPortalThemeLayout`, `LandingIntro`,
    local `nav-config`/`routes`, the visual-only `AdminPortalLoginPage`, the
    `AdminPortalDashboardPage` which reuses `src/components/dashboard/*`, the
    `AdminPortalTeamPage`/`TeamMembers` members table, the `AdminPortalLineUsersPage`
    LINE-user registration-data table (the re-contextualised former "Leads" surface),
    and — from the Phase-3.5 interactivity pass —
    the parameterised `AdminPortalStubPage` placeholder and the header's mock
    notification panel). Adapted from the template's `src/containers/*`,
    `src/features/user/*`, `src/features/leads/index.js`, `src/routes/sidebar.js`,
    `src/pages/protected/Team.js`, `src/pages/protected/{Blank,404}.js`,
    `src/features/common/components/NotificationBodyRightDrawer.js` and
    `src/features/settings/team`. Redux, `theme-change`, `react-notifications`, auth and
    the template's routing were stripped; the whole sidebar is a real React Router menu
    (every target navigates); the light/dark toggle is driven by local React state
    (no `theme-change`); the members table's `moment()` join dates were frozen to fixed
    literals; the `dashwind-light` / `dashwind-dark` daisyUI themes in `src/index.css`
    mirror daisyUI-4's stock `light` / `dark`.
  - Chart.js (`chart.js`), `react-chartjs-2` and `@heroicons/react` are separate
    npm dependencies under their own MIT licenses (covered by their package
    metadata), not copied source, and so are not transcribed here.

```
MIT License

Copyright (c) 2022 Dashwind - Admin Dashboard Template

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

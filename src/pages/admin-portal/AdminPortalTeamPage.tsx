// Adapted from DashWind (daisyui-admin-dashboard-template),
// https://github.com/robbins23/daisyui-admin-dashboard-template — MIT (c) 2022 Dashwind.
// See THIRD_PARTY_NOTICES.md. Ports `pages/protected/Team.js` as a thin page wrapper.
// Stripped: `useDispatch` + `setPageTitle` (the navbar title now comes from
// `nav-config`'s `usePageTitle`). Renders the presentational `<TeamMembers/>` table.
import { TeamMembers } from '@/components/admin-portal/TeamMembers'

/** The replica "Team Members" page — reachable from the Settings → Team Members nav. */
export function AdminPortalTeamPage() {
  return <TeamMembers />
}

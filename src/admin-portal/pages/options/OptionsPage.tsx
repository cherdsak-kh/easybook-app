/**
 * ตัวเลือกบุคลากร — ONE page serving TWO destinations, `ตำแหน่งบุคลากร` and `กลุ่ม/ฝ่ายบุคลากร`.
 *
 * The record is `{ id, name, isSystemReserved, holderCount, … }` in both tables and every endpoint
 * is the same shape, so the screen, its dialog and its confirmation are shared and every word that
 * differs is a string in `option-model.ts`. That mirrors the server exactly: `OptionsService` is one
 * class taking a `model` discriminator, and `routes.ts` already says in a comment not to fork this
 * into two components.
 *
 * ⚠️ IF YOU REACH FOR `if (model === …)` ANYWHERE BELOW, the two screens have genuinely diverged —
 * and that is the moment they stop sharing a route, not the moment to add a branch.
 *
 * ── The list is fetched whole, filtered on the client ──
 * The endpoint returns everything (no pagination, no search parameter), so the footer states a
 * COUNT rather than a pager. Both numbers come from one array — the role-filtered one — because
 * "แสดง 10 รายการ" over nine rows is the classic way this breaks.
 *
 * ⚠️ NO CLIENT-SIDE SORT. The endpoint returns `name ASC` in Postgres's collation, and re-sorting
 * here with `localeCompare(_, 'th')` would produce a DIFFERENT order that disagrees with what a
 * refresh shows. After a create or a rename the page REFETCHES instead, so the row appears where
 * the server would put it. (`D3` in the plan folder is still open on whether the two collations
 * agree; refetching is what keeps this screen honest either way.)
 *
 * ── Reserved rows have no pencil, and that is a guard as well as UX ──
 * The server answers 404 to a rename or delete of a reserved option for EVERY role, SUPER_ADMIN
 * included: they are not CRUD-managed, and a rename would break the CLI's resolve-by-name. So the
 * row gets a padlock where the pencil would be — not a disabled button, which promises it might
 * enable later. A non-SUPER_ADMIN never receives a reserved row at all (`OptionsService.list` takes
 * `includeReserved` as a WHERE clause), so this is not the boundary; the boundary is the server.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ApiError,
  createDepartment,
  createPersonnelRole,
  deleteDepartment,
  deletePersonnelRole,
  listDepartments,
  listPersonnelRoles,
  patchDepartment,
  patchPersonnelRole,
  type Department,
  type PersonnelRole,
} from '@/lib/api-client'
import { Btn } from '../../components/ui/Btn'
import { ConfirmModal } from '../../components/feedback/ConfirmModal'
import { EmptyState } from '../../components/feedback/EmptyState'
import { LoadError, type LoadErrorKind } from '../../components/feedback/LoadError'
import { PageHeading } from '../../components/shell/PageHeading'
import { Skeleton, SkeletonRegion } from '../../components/feedback/Skeleton'
import { useAcl } from '../../lib/use-acl'
import { useAuth } from '../../lib/auth-context'
import { useToast } from '../../lib/toast-context'
import { thaiDate } from '../../lib/thai-date'
import { OptionFormDialog } from './components/OptionFormDialog'
import {
  holdersOf,
  OPTION_COPY,
  OPTION_OF,
  type OptionModel,
  type OptionRecord,
} from './option-model'
import type { AdminRoute } from '../../routes'

/** The four calls, chosen once by model so nothing below asks which table it is on. */
const API = {
  personnelRole: {
    list: listPersonnelRoles,
    create: createPersonnelRole,
    patch: patchPersonnelRole,
    remove: deletePersonnelRole,
  },
  department: {
    list: listDepartments,
    create: createDepartment,
    patch: patchDepartment,
    remove: deleteDepartment,
  },
} as const

/**
 * `DepartmentResponseDto` → the screen's own shape.
 *
 * ⚠️ THE DATES ARE FORMATTED HERE, not in the dialog. `OptionFormDialog` prints `createdAt` and
 * `updatedAt` verbatim — it is props-only and knows nothing about locales — so handing it an ISO
 * string would put `2026-07-14T10:00:00.000Z` on screen in Thai copy.
 */
const toRecord = (r: Department | PersonnelRole): OptionRecord => ({
  id: r.id,
  name: r.name,
  reserved: r.isSystemReserved || undefined,
  lineUsers: r.registrationCount,
  staff: r.staffCount,
  createdAt: thaiDate(r.createdAt),
  updatedAt: thaiDate(r.updatedAt),
})

/** `ApiError` → which of the three error panels. */
const kindOf = (err: unknown): LoadErrorKind => {
  const status = err instanceof ApiError ? err.status : 0
  if (status === 0) return 'network'
  if (status === 403) return 'forbidden'
  return 'server'
}

/** Whole-form failures that leave the dialog open with everything typed intact. */
const WRITE_FAIL: Record<number, string> = {
  403: 'เซสชันความปลอดภัยหมดอายุ ยังไม่ได้บันทึกอะไร โปรดรีเฟรชหน้าแล้วลองใหม่',
  503: 'ระบบขัดข้องชั่วคราว ยังไม่ได้บันทึกอะไร ลองใหม่อีกครั้ง',
  0: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ยังไม่ได้บันทึกอะไร ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่',
}

const ICON = {
  refresh:
    'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99',
  plus: 'M12 4.5v15m7.5-7.5h-15',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  pencil:
    'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z',
  lock: 'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z',
  tag: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z',
} as const

function Glyph({ d, className = 'h-4.5 w-4.5 shrink-0' }: { d: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

export function OptionsPage({ route }: { route: AdminRoute }) {
  const model: OptionModel = OPTION_OF[route.label] ?? 'personnelRole'
  const copy = OPTION_COPY[model]
  const api = API[model]

  const { user, refresh } = useAuth()
  const acl = useAcl(user!.role)
  const toast = useToast()

  const [rows, setRows] = useState<OptionRecord[] | null>(null)
  const [error, setError] = useState<LoadErrorKind | null>(null)
  const [term, setTerm] = useState('')

  /** `null` = closed · `{ target: null }` = create · `{ target: rec }` = rename. */
  const [form, setForm] = useState<{ target: OptionRecord | null; prefill?: string } | null>(null)
  const [formAlert, setFormAlert] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState<OptionRecord | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setRows((await api.list()).map(toRecord))
    } catch (err) {
      setRows(null)
      setError(kindOf(err))
    }
  }, [api])

  // ⚠️ `model` IN THE DEPS, via `load`'s own `[api]`. Navigating ตำแหน่ง ⇄ กลุ่ม/ฝ่าย keeps this
  // component mounted — same route element, different label — so without a refetch the second
  // destination would render the first one's rows under the second one's headings.
  useEffect(() => {
    setRows(null)
    setTerm('')
    void load()
  }, [load])

  // The role filter and the count come from ONE array so they can never disagree. In practice the
  // server has already applied this (`includeReserved` is a WHERE clause, not a post-fetch drop) —
  // it is repeated here because a list that arrives with a row this session may not see is a
  // contract violation the screen should survive, not render.
  const all = useMemo(
    () => (rows ?? []).filter((r) => acl.role === 'SUPER_ADMIN' || !r.reserved),
    [rows, acl.role],
  )
  const trimmed = term.trim()
  const shown = useMemo(
    () => (trimmed ? all.filter((r) => r.name.includes(trimmed)) : all),
    [all, trimmed],
  )

  /**
   * Re-read `/me` after a write that can have moved or renamed the OPERATOR'S OWN option.
   *
   * This is the port of the prototype's `__reidentifyMe`, and its comment says exactly why it
   * exists — including that this is the LIKELY case, not the exotic one:
   *
   *   "If one of the moved rows was YOURS, the sidebar identity card and the profile page are now
   *    printing a ตำแหน่ง that no longer exists — the deleter is very often the person holding it,
   *    since a SUPER_ADMIN is the only one who can delete and 'ผู้ดูแลระบบ' is their own title."
   *
   * ⚠️ UNCONDITIONAL, unlike the prototype's `hitMe` check. That check is cheap there because the
   * directory is a local array; here "did this touch me?" would cost the same request as just
   * asking. `/me` is one small call on a rare, deliberate action, and the alternative is the shell
   * quietly disagreeing with the database about who you are.
   *
   * ⚠️ NEVER FATAL. The write already succeeded and the list is already correct; a failed refresh
   * means the identity card is briefly stale, which a navigation fixes. Turning that into an error
   * toast would report a failure that did not happen.
   */
  const syncSession = async () => {
    try {
      await refresh()
    } catch {
      /* see above — deliberately silent */
    }
  }

  const openCreate = (prefill?: string) => {
    setNameError(null)
    setFormAlert(null)
    setForm({ target: null, prefill })
  }
  const openEdit = (rec: OptionRecord) => {
    // Guard, not UX: nothing renders a pencil on a reserved row, so reaching here means something
    // else called it. The server answers 404 to a rename of one for every role, so opening a form
    // that cannot succeed would be the screen promising what the API refuses.
    if (rec.reserved) return
    setNameError(null)
    setFormAlert(null)
    setForm({ target: rec })
  }
  const closeForm = () => {
    setForm(null)
    setNameError(null)
    setFormAlert(null)
  }

  const submit = async (name: string) => {
    if (!form) return
    const target = form.target
    // "No change" is the page's to report, and it closes rather than sending a PATCH that changes
    // nothing — which the server would accept, bumping `updatedAt` for no reason.
    if (target && name === target.name) {
      closeForm()
      toast('info', 'ไม่มีการเปลี่ยนแปลง จึงยังไม่ได้บันทึกอะไร')
      return
    }

    setBusy(true)
    setNameError(null)
    setFormAlert(null)
    try {
      if (target) await api.patch(target.id, { name })
      else await api.create({ name })
      // Refetch rather than splicing: the endpoint orders by name, and this is how the row lands
      // where a reload would put it. See the header note on sorting.
      await load()
      // A RENAME can be a rename of the option YOU hold, and `/me` resolves `personnelRole.name`
      // fresh — so without this the sidebar card and โปรไฟล์ keep printing the old title. Same
      // reasoning as the delete below; see `syncSession`.
      if (target) await syncSession()
      // A rename can move a row out of the current filter, and then the operator sees nothing at
      // all where they expected their edit. Clearing the search is the only way the result of what
      // they just did is on screen.
      if (trimmed && !name.includes(trimmed)) setTerm('')
      closeForm()
      toast(
        'success',
        target ? `เปลี่ยนชื่อ${copy.noun}เป็น ${name} แล้ว` : `เพิ่ม${copy.noun} ${name} แล้ว`,
      )
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0
      if (status === 409) {
        // A FIELD error, not a banner: the offending value is in that box and the fix is to change
        // it, so the message belongs beside it.
        setNameError(`มี${copy.noun}ชื่อ “${name}” อยู่แล้ว ใช้ชื่ออื่น`)
      } else if (status === 404) {
        // Somebody deleted this row while the dialog was open. Re-sending would recreate it under a
        // new id, so the dialog closes and the list catches up with reality.
        closeForm()
        await load()
        toast('error', `${copy.noun}นี้ถูกลบไปแล้ว รายการถูกปรับให้ตรงกับข้อมูลล่าสุด`)
      } else {
        setFormAlert(WRITE_FAIL[status] ?? WRITE_FAIL[503])
      }
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirming) return
    try {
      await api.remove(confirming.id)
      await load()
      // The delete re-points every holder onto the tombstone, and you are very likely one of them.
      await syncSession()
      setConfirming(null)
      closeForm()
      toast('success', `ลบ${copy.noun} ${confirming.name} แล้ว`)
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0
      // ⚠️ THROWN, NOT SWALLOWED. `ConfirmModal` keeps itself open when `onConfirm` rejects — the
      // operator must see that the delete did not happen, and a dialog that closes on failure is
      // indistinguishable from one that succeeded.
      setConfirming(null)
      closeForm()
      await load()
      toast(
        'error',
        status === 404
          ? `${copy.noun}นี้ถูกลบไปแล้ว รายการถูกปรับให้ตรงกับข้อมูลล่าสุด`
          : `ลบ${copy.noun}ไม่สำเร็จ ยังไม่มีอะไรถูกลบ ลองใหม่อีกครั้ง`,
      )
    }
  }

  const held = confirming ? holdersOf(confirming) : 0

  return (
    <div className="card-shell">
      {/* ⚠️ `PageHeading` IS the header row — its own `justify-between` and bottom margin — so the
          toolbar goes in its `actions` slot rather than beside it. Wrapping both in a second copy
          of that wrapper measured a 111.7px header against the prototype's 95.7: the `lg:mb-4` paid
          twice, pushing the card and its whole contents down 16px.

          `descAtEveryWidth={false}` because this is a TABLE page and the prototype hides the
          subtitle below `sm` — the table explains the page by being it, and the line is worth the
          vertical space only on a wide screen. */}
      <PageHeading
        route={route}
        desc={copy.desc}
        descAtEveryWidth={false}
        actions={
          /* A SOLID primary button here, unlike การลงทะเบียน, which deliberately has none. That
             page is a QUEUE — the work happens per row. This one is a list you MAINTAIN, and adding
             a row is the page's job. */
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              aria-label="รีเฟรช"
              data-tip="รีเฟรช"
              data-tip-pos="bottom"
              className="flex min-h-11 items-center gap-2 rounded-control border border-base-content/20 bg-base-100 px-3 text-[14px] font-medium text-base-content/80 transition-colors hover:border-info/40 hover:bg-info/10 hover:text-info focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-4"
            >
              <Glyph d={ICON.refresh} />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>
            {acl.write && (
              <Btn variant="primary" onClick={() => openCreate()}>
                <Glyph d={ICON.plus} />
                เพิ่ม{copy.noun}
              </Btn>
            )}
          </div>
        }
      />

      <div className="card-shell rounded-card border border-base-300/70 bg-base-100 shadow-e1">
        {/* One control, full width. No status filter (an option row has no status) and no sort. */}
        <div className="flex shrink-0 flex-col gap-2.5 border-b border-base-300 p-3 sm:gap-3 sm:p-4 lg:flex-row lg:items-center lg:p-5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control border border-transparent bg-base-200 px-4 transition-all focus-within:border-primary/40 focus-within:bg-base-100 focus-within:ring-4 focus-within:ring-primary/10">
            <Glyph d={ICON.search} className="h-5 w-5 shrink-0 text-base-content/60" />
            <label className="sr-only" htmlFor="opt-search">
              ค้นหาชื่อ{copy.noun}
            </label>
            <input
              id="opt-search"
              type="search"
              autoCorrect="on"
              autoCapitalize="none"
              spellCheck
              enterKeyHint="search"
              placeholder={`ค้นหาชื่อ${copy.noun}`}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="min-h-11 w-full min-w-0 border-none bg-transparent text-[15px] text-base-content/90 outline-none placeholder:text-base-content/70"
            />
          </div>
        </div>

        {error ? (
          <div className="card-shell">
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
              <LoadError kind={error} onRetry={() => void load()} />
            </div>
          </div>
        ) : rows === null ? (
          <LoadingPanel noun={copy.noun} actionsLabel={acl.actionsColumnLabel} />
        ) : all.length === 0 ? (
          <div className="card-shell">
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
              <EmptyState
                icon={<Glyph d={ICON.tag} className="h-8 w-8 text-base-content/60" />}
                title={`ยังไม่มี${copy.noun}ในระบบ`}
                description={copy.emptyDesc}
                actions={
                  acl.write ? (
                    <Btn variant="primary" onClick={() => openCreate()}>
                      <Glyph d={ICON.plus} />
                      เพิ่ม{copy.noun}แรก
                    </Btn>
                  ) : undefined
                }
              />
            </div>
          </div>
        ) : (
          <div className="card-shell">
            <div className="card-scroll nav-scroll">
              {shown.length === 0 ? (
                /* ⚠️ NOT the empty state. "ยังไม่มี…ในระบบ" and "คำค้นนี้ไม่ตรงกับอะไรเลย" are
                   different facts with different ways out, and the second is a property of what the
                   operator typed rather than of what the server returned. Merging them tells
                   somebody the list is empty when it is not. */
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-base-200">
                    <Glyph d={ICON.search} className="h-8 w-8 text-base-content/60" />
                  </div>
                  <h2 className="th-tight text-[18px] font-semibold text-base-content">
                    ไม่พบ{copy.noun}ที่ค้นหา
                  </h2>
                  <p className="th-tight mt-1.5 max-w-sm text-[14px] text-base-content/70">
                    ไม่มี{copy.noun}ที่ชื่อตรงกับ “
                    <span className="font-medium text-base-content/90">{trimmed}</span>” ลองใช้คำที่สั้นลง
                    หรือเพิ่มเข้าไปใหม่
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    <Btn variant="ghost" onClick={() => setTerm('')}>
                      ล้างคำค้นหา
                    </Btn>
                    {acl.write && (
                      <Btn variant="primary" onClick={() => openCreate(trimmed)}>
                        เพิ่ม “{trimmed}” เข้าไป
                      </Btn>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="hidden lg:block">
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr>
                          <th scope="col" className="th-cell w-16 text-center">
                            ลำดับ
                          </th>
                          <th scope="col" className="th-cell">
                            ชื่อ{copy.noun}
                          </th>
                          <th scope="col" className="th-cell whitespace-nowrap text-center">
                            {copy.colHolders}
                          </th>
                          <th scope="col" className="th-cell whitespace-nowrap text-center">
                            แก้ไขล่าสุด
                          </th>
                          <th scope="col" data-col="actions" className="th-cell text-right">
                            {acl.actionsColumnLabel}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((rec, i) => (
                          <Row
                            key={rec.id}
                            rec={rec}
                            index={i + 1}
                            noun={copy.noun}
                            write={acl.write}
                            onEdit={() => openEdit(rec)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <ul className="m-0 list-none divide-y divide-base-300/60 p-0 lg:hidden">
                    {shown.map((rec) => (
                      <Card
                        key={rec.id}
                        rec={rec}
                        noun={copy.noun}
                        write={acl.write}
                        onEdit={() => openEdit(rec)}
                      />
                    ))}
                  </ul>
                </>
              )}
            </div>

            {/* A COUNT, not a pager — the endpoint returns everything. */}
            <div className="flex shrink-0 flex-col items-center justify-between gap-3 border-t border-base-300 p-4 sm:flex-row lg:px-5">
              <p className="text-[14px] text-base-content/70">
                ทั้งหมด{' '}
                <span className="font-medium tabular-nums text-base-content/90">{all.length}</span>{' '}
                {copy.noun}
                {trimmed && (
                  <>
                    {' '}
                    · ตรงกับคำค้นหา{' '}
                    <span className="font-medium tabular-nums text-base-content/90">
                      {shown.length}
                    </span>{' '}
                    {copy.noun}
                  </>
                )}
              </p>
              <p className="text-[13px] text-base-content/70">เรียงตามชื่อ ก–ฮ</p>
            </div>
          </div>
        )}
      </div>

      <OptionFormDialog
        open={form !== null}
        onClose={closeForm}
        model={model}
        target={form?.target ?? null}
        prefill={form?.prefill ?? ''}
        alert={formAlert}
        nameError={nameError}
        busy={busy}
        onSubmit={(name) => void submit(name)}
        onDelete={() => form?.target && setConfirming(form.target)}
      />

      <ConfirmModal
        open={confirming !== null}
        // Back to the FORM, which is still open underneath — the operator opened the confirmation
        // to read the holder count, and "no" means they want the dialog they came from.
        onClose={() => setConfirming(null)}
        onConfirm={remove}
        title={`ลบ${copy.noun}`}
        who={`${copy.noun} “${confirming?.name ?? ''}”`}
        // The count is not a warning decoration — it is the number of records this click is about
        // to rewrite, so it is stated BEFORE the verb and the destination is named in full.
        description={
          held
            ? `${copy.delLead} ${held} คน (ผู้ใช้ LINE ${confirming?.lineUsers ?? 0} คน, เจ้าหน้าที่ระบบ ${confirming?.staff ?? 0} คน) ${copy.holdersMove}`
            : copy.holdersNone
        }
        tone="danger"
        confirmLabel={`ลบ${copy.noun}`}
        busyLabel="กำลังลบ"
      />
    </div>
  )
}

/**
 * ⚠️ THE ACTION SLOT IS 44px AT EVERY WIDTH, and it is why the mobile card is not a tap target.
 *
 * การลงทะเบียน makes the whole row a link, and that is right there: the row opens a record and
 * every row has one. Here the reserved row has no record to open, so a full-row target would leave
 * the operator tapping a dead card with a padlock floating somewhere inside it and no answer under
 * their thumb. A fixed slot puts the lock exactly where the pencil would have been, at both widths.
 */
function Actions({
  rec,
  noun,
  write,
  onEdit,
}: {
  rec: OptionRecord
  noun: string
  write: boolean
  onEdit: () => void
}) {
  if (rec.reserved) {
    // NOT a disabled <button>. A disabled control is a promise that it might enable later; this one
    // never will, for anybody. It is also not focusable, so the sr-only line — not the tooltip — is
    // what carries the reason to a screen reader.
    const why = `${noun}สงวนของระบบ แก้ไขและลบไม่ได้`
    return (
      <span
        data-tip={why}
        data-tip-pos="left"
        className="flex h-11 w-11 shrink-0 items-center justify-center text-base-content/60"
      >
        <Glyph d={ICON.lock} className="h-5 w-5" />
        <span className="sr-only">{why}</span>
      </span>
    )
  }
  if (!write) return null
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`แก้ไข${noun} ${rec.name}`}
      data-tip="แก้ไข"
      data-tip-pos="left"
      className="icon-btn icon-btn-edit shrink-0"
    >
      <Glyph d={ICON.pencil} className="h-5 w-5" />
    </button>
  )
}

/** `0 คน` is MUTED, never an em-dash — a dash reads as "no data", and whether anybody holds this
 *  row is the single fact the delete decision turns on, so it must not look like a missing value. */
function Usage({ rec }: { rec: OptionRecord }) {
  const n = holdersOf(rec)
  return <span className={n ? 'text-base-content/90' : 'text-base-content/70'}>{n} คน</span>
}

function ReservedChip() {
  return (
    <span className="badge badge-slate shrink-0 gap-1">
      <Glyph d={ICON.lock} className="h-3.5 w-3.5 shrink-0" />
      สงวนของระบบ
    </span>
  )
}

function Row({
  rec,
  index,
  noun,
  write,
  onEdit,
}: {
  rec: OptionRecord
  index: number
  noun: string
  write: boolean
  onEdit: () => void
}) {
  return (
    <tr className="group border-b border-base-300/60 transition-colors hover:bg-base-content/5">
      <td className="td-cell text-center tabular-nums text-base-content/70">{index}</td>
      <td className="td-cell">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[15px] font-medium text-base-content">{rec.name}</span>
          {rec.reserved && <ReservedChip />}
        </span>
      </td>
      <td className="td-cell text-center tabular-nums">
        <Usage rec={rec} />
      </td>
      <td className="td-cell whitespace-nowrap text-center text-[14px] text-base-content/80">
        {rec.updatedAt}
      </td>
      <td data-col="actions" className="td-cell">
        <div className="ml-auto flex w-fit justify-end opacity-70 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <Actions rec={rec} noun={noun} write={write} onEdit={onEdit} />
        </div>
      </td>
    </tr>
  )
}

function Card({
  rec,
  noun,
  write,
  onEdit,
}: {
  rec: OptionRecord
  noun: string
  write: boolean
  onEdit: () => void
}) {
  return (
    <li className="flex items-center gap-3 py-1.5 pl-4 pr-1.5">
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[15px] font-medium text-base-content">{rec.name}</span>
          {rec.reserved && <ReservedChip />}
        </span>
        <span className="mt-0.5 block text-[13px] text-base-content/70">
          <Usage rec={rec} /> · แก้ไข {rec.updatedAt}
        </span>
      </span>
      <Actions rec={rec} noun={noun} write={write} onEdit={onEdit} />
    </li>
  )
}

/**
 * ⚠️ `table-fixed` + a colgroup, because an AUTO-layout table sizes columns to their widest
 * CONTENT and a skeleton's content is bars — so every column snaps sideways the moment the real
 * names land, which is the one thing a skeleton exists to prevent. The footer stand-in is there for
 * the same reason at the other axis: without it the card loses its count bar's height while loading
 * and shoves the page up and back down.
 */
function LoadingPanel({ noun, actionsLabel }: { noun: string; actionsLabel: string }) {
  const bars = Array.from({ length: 8 }, (_, i) => i)
  return (
    <SkeletonRegion label={`กำลังโหลดรายการ${noun}`} className="card-shell">
      <div className="card-scroll nav-scroll">
        <div className="hidden lg:block">
          <table className="w-full table-fixed border-collapse text-left">
            <colgroup>
              <col style={{ width: '8%' }} />
              <col style={{ width: '44%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '14%' }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="th-cell w-16 text-center">
                  ลำดับ
                </th>
                <th scope="col" className="th-cell">
                  ชื่อ{noun}
                </th>
                <th scope="col" className="th-cell whitespace-nowrap text-center">
                  จำนวนผู้ถือ
                </th>
                <th scope="col" className="th-cell whitespace-nowrap text-center">
                  แก้ไขล่าสุด
                </th>
                <th scope="col" data-col="actions" className="th-cell text-right">
                  {actionsLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {bars.map((i) => (
                <tr key={i} className="border-b border-base-300/60">
                  <td className="td-cell">
                    <Skeleton className="mx-auto h-3.5" width="1.5rem" />
                  </td>
                  <td className="td-cell">
                    <Skeleton className="h-3.5" width="60%" />
                  </td>
                  <td className="td-cell">
                    <Skeleton className="mx-auto h-3.5" width="3rem" />
                  </td>
                  <td className="td-cell">
                    <Skeleton variant="soft" className="mx-auto h-3.5" width="5rem" />
                  </td>
                  <td className="td-cell">
                    <Skeleton variant="box" className="ml-auto h-8 w-8" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="m-0 list-none divide-y divide-base-300/60 p-0 lg:hidden">
          {bars.map((i) => (
            <li key={i} className="flex items-center gap-3 py-3.5 pl-4 pr-1.5">
              <span className="min-w-0 flex-1">
                <Skeleton className="h-3.5" width="55%" />
                <Skeleton variant="soft" className="mt-1.5 h-3" width="35%" />
              </span>
              <Skeleton variant="box" className="h-8 w-8 shrink-0" />
            </li>
          ))}
        </ul>
      </div>

      <div className="flex shrink-0 flex-col items-center justify-between gap-3 border-t border-base-300 p-4 sm:flex-row lg:px-5">
        <Skeleton variant="soft" className="h-3.5" width="9rem" />
        <Skeleton variant="soft" className="h-3.5" width="6rem" />
      </div>
    </SkeletonRegion>
  )
}

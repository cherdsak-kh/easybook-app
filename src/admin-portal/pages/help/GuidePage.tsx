/**
 * `/backend/help/guide` — คู่มือการใช้งานระบบ.
 *
 * Ported from the prototype's `<div data-route="guide">` and its guide module
 * (`master_layout_prototype_v2.html`). The articles are data in `guide-content.tsx`; every decision
 * about WHICH of them show is a pure function in `guide-model.ts`. This file is the state and the
 * frame around them.
 *
 * ── THE MENU FILTER IS RECOMPUTED, NEVER PATCHED ──
 * The visible topics are `GUIDE_FACTS.filter(matches(query, role))` on every render. There is no
 * incremental "hidden" state to drift out of step, and the ACTIVE topic is derived from that list:
 * if a filter removes it, the first visible topic takes over; if nothing is visible the article is
 * replaced by the empty state (with the last article left up, the screen would contradict its
 * own menu).
 *
 * ── THE OPEN TOPIC LIVES IN THE URL: `?topic=<id>` ──
 * Written with `replace`, so reading ten topics is one history entry and not ten Back presses. An
 * explicit `?topic=` wins over a filter that would hide it (the filters are cleared), and an
 * unknown id falls back to the default. The prototype's `#guide/<id>` is a hash-router artefact;
 * the back-office routes by path.
 *
 * ── DEEP LINKS OUT ARE DERIVED FROM THE ACL, NEVER HAND-LISTED ──
 * A link renders only when `useAcl(role).can(label)` AND the label has a designed screen, so a
 * ผู้ดูข้อมูล reading the การตั้งค่าระบบ article sees no button into การตั้งค่าระบบ, and a future ACL
 * change needs no edit here. A refused link is ABSENT, not disabled — a dead button in a manual is
 * worse than none.
 *
 * ── PRINT ──
 * The article card carries `data-gd-print`; the `@media print` rules in `admin-portal.css` remove
 * everything that neither contains nor is inside it. Paper is always the light theme and a closed
 * `<details>` prints closed, so `beforeprint` (which Ctrl+P fires too, not only the button) puts a
 * light theme on the card and opens every `<details>` in it; `afterprint` undoes both.
 */

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { GUIDE_ARTICLES, GUIDE_GROUPS } from './guide-content'
import { PATH } from './guide-icon-paths'
import {
  DEFAULT_TOPIC,
  GUIDE_ROLES,
  GUIDE_ROLE_OF,
  countLabel,
  describeEmpty,
  neighbours,
  relevanceLine,
  resolveActive,
  searchTextOf,
  topicMatches,
  type GuideArticle,
  type GuideRole,
  type RoleFilter,
} from './guide-model'
import { Ico } from './GuideIcon'
import { PageHeading } from '../../components/shell/PageHeading'
import { useAuth } from '../../lib/auth-context'
import { useAcl } from '../../lib/use-acl'
import { ROLE_LABEL, type SystemRole } from '../../labels'
import { routeOf, urlOf, type AdminRoute, type AdminRouteLabel } from '../../routes'

/** What the pill and the "บทบาทของคุณ" line call each role — `ROLE_LABEL` by another key. */
const SYSTEM_ROLE_OF: Record<GuideRole, SystemRole> = {
  viewer: 'VIEWER',
  admin: 'ADMIN',
  super: 'SUPER_ADMIN',
}
const roleName = (r: GuideRole) => ROLE_LABEL[SYSTEM_ROLE_OF[r]]

/** Computed once: the words each topic can be found by. See `searchTextOf`. */
const FACTS = GUIDE_ARTICLES.map((a) => ({
  id: a.id,
  roles: a.roles,
  text: searchTextOf(a, GUIDE_GROUPS),
}))
const ARTICLE_BY_ID = new Map(GUIDE_ARTICLES.map((a) => [a.id, a]))
const isTopicId = (s: string | null): s is string => s !== null && ARTICLE_BY_ID.has(s)

/** The prototype's `.btn-sm` shim: smaller type and padding, never smaller than 44px. */
const BTN_SM = 'btn btn-sm min-h-11 gap-1.5 px-3 text-[13px] font-medium'

export function GuidePage({
  route,
  isDesigned,
}: {
  route: AdminRoute
  /** Whether a label has a real screen — `DESIGNED` in `BackendRoutes`, passed in to avoid a cycle. */
  isDesigned: (label: AdminRouteLabel) => boolean
}) {
  const { user } = useAuth()
  const me = GUIDE_ROLE_OF[user!.role]
  const acl = useAcl(user!.role)

  const [params, setParams] = useSearchParams()
  const topicParam = params.get('topic')
  const requested = isTopicId(topicParam) ? topicParam : DEFAULT_TOPIC

  const [query, setQuery] = useState('')
  const [role, setRole] = useState<RoleFilter>('all')
  const [printing, setPrinting] = useState(false)

  const visibleIds = useMemo(
    () => FACTS.filter((f) => topicMatches(f, query, role)).map((f) => f.id),
    [query, role],
  )
  const activeId = resolveActive(requested, visibleIds)
  const article = activeId ? ARTICLE_BY_ID.get(activeId)! : null
  const { prev, next } = activeId ? neighbours(visibleIds, activeId) : { prev: null, next: null }

  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  /* ── the URL follows the open topic ──
     `own` is every `?topic=` value this page has written, plus the one it mounted with. A value
     outside that set arrived from outside (a link, the address bar) and, if the filters hide it,
     must WIN: the filters are cleared. A set rather than "the last value written", because the
     router applies our own `replace` in a later render than the click — for one render `topicParam`
     still holds the PREVIOUS own value, which must not be mistaken for a foreign link and wipe the
     search the reader just typed. */
  const own = useRef<Set<string | null>>(new Set([topicParam]))
  useEffect(() => {
    if (!own.current.has(topicParam) && isTopicId(topicParam) && !visibleIds.includes(topicParam)) {
      own.current.add(topicParam)
      setQuery('')
      setRole('all')
      return
    }
    if (activeId && topicParam !== activeId) {
      own.current.add(activeId)
      setParams(
        (p) => {
          const n = new URLSearchParams(p)
          n.set('topic', activeId)
          return n
        },
        { replace: true },
      )
    }
  }, [topicParam, activeId, visibleIds, setParams])

  /* ── focus the title of the topic that was just opened ──
     `wantFocus` holds the TARGET id: the route update and the article swap land in a later commit
     than the click, so focusing on the click would focus the article that is about to unmount. */
  const wantFocus = useRef<string | null>(null)
  const [focusTick, setFocusTick] = useState(0)
  useEffect(() => {
    if (wantFocus.current !== null && wantFocus.current === activeId) {
      titleRef.current?.focus({ preventScroll: true })
      wantFocus.current = null
    }
  }, [activeId, focusTick])

  function openTopic(id: string) {
    wantFocus.current = id
    own.current.add(id)
    setParams(
      (p) => {
        const n = new URLSearchParams(p)
        n.set('topic', id)
        return n
      },
      { replace: true },
    )
    setFocusTick((t) => t + 1)
    // From `lg` the menu and the article sit side by side, so scroll only when the reader has gone
    // down the page and the card's top is above the viewport. Below `lg` the menu is ABOVE the
    // article and every tap has to bring it into view.
    const wide = window.matchMedia('(min-width: 1024px)').matches
    const panel = panelRef.current
    const root = rootRef.current
    if (panel && root && (!wide || panel.getBoundingClientRect().top < root.getBoundingClientRect().top)) {
      panel.scrollIntoView({ block: 'start' })
    }
  }

  function clearFilters() {
    setQuery('')
    setRole('all')
    searchRef.current?.focus()
  }

  /* ── print: light theme on the card, every <details> open; both undone afterwards ── */
  useEffect(() => {
    let reopened: HTMLDetailsElement[] = []
    const before = () => {
      flushSync(() => setPrinting(true))
      reopened = Array.from(
        panelRef.current?.querySelectorAll<HTMLDetailsElement>('details:not([open])') ?? [],
      )
      reopened.forEach((d) => {
        d.open = true
      })
    }
    const after = () => {
      setPrinting(false)
      reopened.forEach((d) => {
        d.open = false
      })
      reopened = []
    }
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
    }
  }, [])

  const groups = GUIDE_GROUPS.map((g) => ({
    group: g,
    items: GUIDE_ARTICLES.filter((a) => a.group === g.id && visibleIds.includes(a.id)),
  })).filter((g) => g.items.length > 0)

  return (
    <div ref={rootRef} className="card-shell rp-page relative lg:overflow-y-auto">
      {/* The page's own sentence, ported word for word (PO, Q3: "ผู้อนุมัติ" is kept even though
          it is not one of the three roles). */}
      <PageHeading
        route={route}
        title="คู่มือการใช้งานระบบ"
        desc="คู่มือและขั้นตอนการปฏิบัติงานสำหรับเจ้าหน้าที่ ผู้อนุมัติ และผู้ดูแลระบบ EasyBook"
        toolbar
        actions={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <label className="sr-only" htmlFor="guide-search">
              ค้นหาหัวข้อคู่มือ
            </label>
            <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
              <Ico
                d={PATH.SEARCH}
                className="pointer-events-none absolute left-3 top-1/2 z-10 h-4.5 w-4.5 -translate-y-1/2 text-base-content/60"
              />
              <input
                ref={searchRef}
                id="guide-search"
                type="search"
                className="input input-sm h-11 w-full pl-10 pr-3.5 text-[15px] placeholder:text-base-content/70"
                placeholder="ค้นหาหัวข้อคู่มือ..."
                autoComplete="off"
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && query) {
                    e.preventDefault()
                    setQuery('')
                  }
                }}
              />
            </div>
            <button
              type="button"
              className="btn btn-sm btn-ghost min-h-11 shrink-0"
              aria-label="พิมพ์หัวข้อนี้"
              onClick={() => window.print()}
            >
              <Ico d={PATH.PRINT} className="h-4.5 w-4.5 shrink-0" />
              <span className="hidden sm:inline">พิมพ์</span>
            </button>
          </div>
        }
      />

      <div className="flex flex-col gap-4 pb-1 lg:flex-row lg:items-start">
        {/* ── Left: role pills + topic menu ──
            `menu` is daisyUI's own; the active row is `bg-primary/10 text-primary`, the same tint
            the booking tabs use, instead of daisyUI's `menu-active` (a solid fill nothing else in
            the portal uses). Group titles are lifted from daisyUI's 40% opacity to 70% for contrast. */}
        <aside aria-label="สารบัญคู่มือ" className="w-full shrink-0 lg:w-72 xl:w-80">
          <div className="rounded-card border border-base-300/70 bg-base-100 p-3 shadow-e1 sm:p-4">
            <p id="gd-role-l" className="m-0 mb-2 text-[13px] font-semibold text-base-content/70">
              แสดงหัวข้อสำหรับบทบาท
            </p>
            <div role="group" aria-labelledby="gd-role-l" className="flex flex-wrap gap-2">
              {(['all', ...GUIDE_ROLES] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={role === r}
                  onClick={() => setRole(r)}
                  className={`${BTN_SM} rounded-full ${role === r ? 'btn-primary' : ''}`.trim()}
                >
                  {r === 'all' ? 'ทั้งหมด' : roleName(r)}
                </button>
              ))}
            </div>
            <p
              role="status"
              className="m-0 mt-3 text-[13px] text-base-content/70 tabular-nums"
            >
              {countLabel(visibleIds.length, GUIDE_ARTICLES.length)}
            </p>

            <nav aria-label="หัวข้อคู่มือ" className="mt-2">
              <ul className="menu m-0 w-full gap-1 p-0">
                {groups.map(({ group, items }) => (
                  <li key={group.id}>
                    <h2 className="menu-title px-2 py-1.5 text-[13px] font-semibold text-base-content/70">
                      {group.th} <span className="font-normal">{group.en}</span>
                    </h2>
                    <ul className="m-0 p-0 whitespace-normal">
                      {items.map((a) => {
                        const on = a.id === activeId
                        return (
                          <li key={a.id}>
                            <button
                              type="button"
                              aria-current={on ? 'true' : undefined}
                              onClick={() => openTopic(a.id)}
                              className={`block min-h-11 w-full rounded-control px-3 py-2.5 text-left text-[14px] leading-[1.45] whitespace-normal focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary focus-visible:[outline-style:solid] ${
                                on ? 'bg-primary/10 text-primary font-medium' : ''
                              }`.trim()}
                            >
                              {a.title}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </aside>

        {/* ── Right: the article ──
            `data-theme` is set ONLY while printing: paper is always the light theme, and this is
            the one element whose subtree reaches it. */}
        <div
          ref={panelRef}
          data-gd-print
          data-theme={printing ? 'easybook-admin' : undefined}
          className="min-w-0 flex-1 rounded-card border border-base-300/70 bg-base-100 shadow-e1"
        >
          {article ? (
            <>
              <ArticleView
                key={article.id}
                article={article}
                me={me}
                titleRef={titleRef}
                canLink={(l) => acl.can(l) && isDesigned(l)}
              />
              <div
                data-gd-pager
                className="flex flex-col gap-2 border-t border-base-300 px-4 py-4 sm:flex-row sm:items-stretch sm:justify-between sm:px-5"
              >
                {prev && (
                  <button
                    type="button"
                    onClick={() => openTopic(prev)}
                    className="btn h-auto min-w-0 justify-start py-2 text-left sm:max-w-[48%]"
                  >
                    <Ico d={PATH.BACK} className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 whitespace-normal">
                      <span className="block text-[12px] font-normal text-base-content/70">
                        หัวข้อก่อนหน้า
                      </span>
                      <span className="block leading-[1.4]">{ARTICLE_BY_ID.get(prev)!.title}</span>
                    </span>
                  </button>
                )}
                {next && (
                  <button
                    type="button"
                    onClick={() => openTopic(next)}
                    className="btn h-auto min-w-0 justify-end py-2 text-right sm:ml-auto sm:max-w-[48%]"
                  >
                    <span className="min-w-0 whitespace-normal">
                      <span className="block text-[12px] font-normal text-base-content/70">
                        หัวข้อถัดไป
                      </span>
                      <span className="block leading-[1.4]">{ARTICLE_BY_ID.get(next)!.title}</span>
                    </span>
                    <Ico d={PATH.ARROW} className="h-4 w-4 shrink-0" />
                  </button>
                )}
              </div>
            </>
          ) : (
            /* Zero-result state. Replaces the article rather than sitting beside it. */
            <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
              <span
                aria-hidden="true"
                className="flex h-14 w-14 items-center justify-center rounded-card bg-primary/10 text-primary"
              >
                <Ico d={PATH.SEARCH} className="h-7 w-7" sw={1.6} />
              </span>
              <div className="max-w-md">
                <h2 className="m-0 text-[18px] font-semibold text-base-content th-tight">
                  ไม่พบหัวข้อที่ตรงกัน
                </h2>
                <p className="m-0 mt-2 text-[14px] leading-[1.7] text-base-content/70 th-tight">
                  {describeEmpty(query, role)}
                </p>
              </div>
              <button type="button" className="btn btn-sm min-h-11" onClick={clearFilters}>
                ล้างการค้นหาและตัวกรอง
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ArticleView({
  article,
  me,
  titleRef,
  canLink,
}: {
  article: GuideArticle
  me: GuideRole
  titleRef: RefObject<HTMLHeadingElement | null>
  canLink: (label: AdminRouteLabel) => boolean
}) {
  const group = GUIDE_GROUPS.find((g) => g.id === article.group)!
  const roleBadges =
    article.roles.length === GUIDE_ROLES.length ? ['ทุกบทบาท'] : article.roles.map(roleName)

  return (
    <article>
      <header className="border-b border-base-300 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-primary">{group.th}</span>
          {roleBadges.map((b) => (
            <span key={b} className="badge badge-slate">
              {b}
            </span>
          ))}
        </div>
        <h2
          ref={titleRef}
          tabIndex={-1}
          className="m-0 mt-3 text-[18px] font-semibold text-base-content th-tight sm:text-[20px]"
        >
          {article.title}
        </h2>
        <p className="m-0 mt-0.5 text-[14px] text-base-content/70">{article.en}</p>
        <p className="m-0 mt-2 flex items-center gap-1.5 text-[13px] text-base-content/70">
          <Ico d={PATH.CLOCK} className="h-4 w-4 shrink-0" />
          อ่านประมาณ {article.readMin} นาที
        </p>
        <p className="m-0 mt-2 text-[13px] leading-[1.55] text-base-content/80">
          {relevanceLine(me, article.roles)}
        </p>
      </header>

      {/* "ในหน้านี้", built from the article's own sections so it can never list one that is not
          there. Skipped under two: a contents list of one line is noise. */}
      {article.sections.length >= 2 && (
        <nav
          aria-label="ในหน้านี้"
          className="border-b border-base-300 bg-base-200 px-4 py-3 sm:px-5"
        >
          <p className="m-0 text-[13px] font-semibold text-base-content/70">
            ในหน้านี้ (On this page)
          </p>
          <ul className="m-0 flex list-none flex-wrap gap-x-5 p-0">
            {article.sections.map((s, i) => (
              <li key={s.title}>
                <button
                  type="button"
                  className="db-link"
                  onClick={() =>
                    document.getElementById(`gd-${article.id}-${i}`)?.scrollIntoView({ block: 'start' })
                  }
                >
                  {s.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="flex flex-col gap-6 px-4 py-5 sm:px-5">
        {article.sections.map((s, i) => {
          const links = (s.links ?? []).filter(canLink)
          return (
            <section key={s.title} id={`gd-${article.id}-${i}`}>
              <h3 className="m-0 mb-2.5 text-[16px] font-semibold text-base-content th-tight">
                {s.title}
              </h3>
              {s.body}
              {links.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {links.map((label, n) => (
                    <Link
                      key={label}
                      to={urlOf(routeOf(label)!)}
                      className={`${BTN_SM} ${n === 0 ? 'btn-primary' : ''}`.trim()}
                    >
                      <span className="min-w-0">{label}</span>
                      <Ico d={PATH.ARROW} className="h-4 w-4 shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </article>
  )
}

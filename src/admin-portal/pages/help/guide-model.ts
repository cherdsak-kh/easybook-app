/**
 * `/backend/help/guide` — the pure half: types for the article data, and every decision the page
 * makes about WHICH topics show. No DOM, no router, no React state, so the filter can be pinned
 * by `tests/unit/admin-portal/pages/help/guide-model.test.ts` without rendering anything.
 *
 * Ported from the prototype's guide module (`master_layout_prototype_v2.html`, the
 * `// ── คู่มือการใช้งาน` IIFE): `matches()`, `render()`'s count and empty message, `paintMe()`.
 */

import { isValidElement, type ReactNode } from 'react'
import type { SystemRole } from '../../labels'
import type { AdminRouteLabel } from '../../routes'

/** The prototype's role keys (`data-roles`). The API's `SystemRole` maps onto them one-to-one. */
export type GuideRole = 'viewer' | 'admin' | 'super'
export type RoleFilter = 'all' | GuideRole

export const GUIDE_ROLE_OF: Record<SystemRole, GuideRole> = {
  VIEWER: 'viewer',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super',
}

/** The three pills after `ทั้งหมด`, in the prototype's order. */
export const GUIDE_ROLES: readonly GuideRole[] = ['viewer', 'admin', 'super']

export type GuideGroupId =
  | 'overview'
  | 'booking'
  | 'venues'
  | 'users'
  | 'reports'
  | 'troubleshooting'

export interface GuideGroup {
  id: GuideGroupId
  /** The Thai name — also the badge on the article header. */
  th: string
  /** The English gloss, shown only beside the group title in the menu. */
  en: string
}

export interface GuideSection {
  /** The `<h3>`, and the entry in the article's "ในหน้านี้" strip. */
  title: string
  body: ReactNode
  /**
   * Deep links at the foot of the section. First = `btn-primary`, the rest plain. Typed by
   * `AdminRouteLabel`, so renaming or removing a menu row is a BUILD error here rather than a
   * dead button in a manual.
   */
  links?: readonly AdminRouteLabel[]
}

export interface GuideArticle {
  id: string
  group: GuideGroupId
  roles: readonly GuideRole[]
  /** Menu label and `<h2>` — the prototype writes them identically. */
  title: string
  en: string
  readMin: number
  sections: readonly GuideSection[]
}

export const DEFAULT_TOPIC = 'rbac'

/** Lower-case, collapse whitespace, trim — the prototype's `norm()`. */
export function normalise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * The text of a React node, read from the tree rather than from the DOM — so the search never
 * needs the articles to be mounted, and the words searched are by construction the words written.
 * Elements that are components (the icon helper) carry no children, so they contribute nothing.
 */
export function plainText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(plainText).join(' ')
  if (isValidElement<{ children?: ReactNode }>(node)) return plainText(node.props.children)
  return ''
}

/**
 * Everything a search may match for one article: the menu label, the badges, the title, the
 * gloss, the section titles, the body text and the names of the screens it links to. The
 * prototype took `li.textContent + article.textContent`, which is the same set.
 */
export function searchTextOf(article: GuideArticle, groups: readonly GuideGroup[]): string {
  const group = groups.find((g) => g.id === article.group)
  const parts: string[] = [
    article.title,
    group?.th ?? '',
    article.title,
    article.en,
    `อ่านประมาณ ${article.readMin} นาที`,
  ]
  for (const s of article.sections) {
    parts.push(s.title, plainText(s.body), ...(s.links ?? []))
  }
  return normalise(parts.join(' '))
}

export interface TopicFacts {
  roles: readonly GuideRole[]
  /** Already `normalise`d — see `searchTextOf`. */
  text: string
}

/**
 * The menu filter: the role pill AND the search, recomputed from scratch on every change.
 * Search is every whitespace-separated word having to appear somewhere in the topic, so
 * "ปฏิเสธ เหตุผล" narrows rather than widens.
 */
export function topicMatches(topic: TopicFacts, query: string, role: RoleFilter): boolean {
  if (role !== 'all' && !topic.roles.includes(role)) return false
  const words = normalise(query).split(' ').filter(Boolean)
  return words.every((w) => topic.text.includes(w))
}

/**
 * `ทั้งหมด N หัวข้อ` when nothing is filtered out, `พบ N จาก M หัวข้อ` otherwise.
 * ⚠️ The test is `shown === total`, not "no filter is set": the super-admin pill hides nothing, and
 * the prototype reads `ทั้งหมด 11 หัวข้อ` under it.
 */
export function countLabel(shown: number, total: number): string {
  return shown === total ? `ทั้งหมด ${total} หัวข้อ` : `พบ ${shown} จาก ${total} หัวข้อ`
}

const ROLE_TH: Record<GuideRole, string> = {
  viewer: 'ผู้ดูข้อมูล',
  admin: 'เจ้าหน้าที่ดูแลระบบ',
  super: 'ผู้ดูแลระบบสูงสุด',
}

/** The zero-result sentence, naming whichever of the two filters is responsible. */
export function describeEmpty(query: string, role: RoleFilter): string {
  const bits: string[] = []
  if (normalise(query)) bits.push(`คำค้น “${query.trim()}”`)
  if (role !== 'all') bits.push(`บทบาท ${ROLE_TH[role]}`)
  return `ไม่มีหัวข้อที่ตรงกับ ${bits.join(' และ ')} ลองใช้คำอื่น หรือล้างตัวกรอง`
}

/**
 * The line under each title: does this topic describe work the signed-in role can do? Relevance,
 * not a capability promise — a ผู้ดูข้อมูล reading the reports topic is on the right page and still
 * cannot export.
 */
export function relevanceLine(me: GuideRole, topicRoles: readonly GuideRole[]): string {
  const ok = topicRoles.includes(me)
  return `บทบาทของคุณ: ${ROLE_TH[me]} · ${
    ok
      ? 'หัวข้อนี้ตรงกับงานของบทบาทนี้'
      : 'อ่านเพื่อทราบได้ แต่บทบาทนี้ไม่มีสิทธิ์ดำเนินการตามขั้นตอนในหัวข้อนี้'
  }`
}

/**
 * Which topic is open: the requested one if the menu still lists it, otherwise the first the menu
 * does list, otherwise none (the empty state). The active topic is never left on a topic the menu
 * is hiding.
 */
export function resolveActive(requested: string, visibleIds: readonly string[]): string | null {
  if (visibleIds.includes(requested)) return requested
  return visibleIds[0] ?? null
}

/** Previous / next over the VISIBLE list, so filtering never points the pager at a hidden topic. */
export function neighbours(
  visibleIds: readonly string[],
  id: string,
): { prev: string | null; next: string | null } {
  const i = visibleIds.indexOf(id)
  if (i < 0) return { prev: null, next: null }
  return { prev: visibleIds[i - 1] ?? null, next: visibleIds[i + 1] ?? null }
}

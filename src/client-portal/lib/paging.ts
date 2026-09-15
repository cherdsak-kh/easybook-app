import type { components } from '@/lib/api-types'

/**
 * The `{ data, meta, facets }` envelope both LIFF lists answer with (`CLIENT-PAGINATION-1`).
 *
 * ⚠️ `facets` IS COMPUTED OVER THE SEARCHED SET, NOT OVER THE PAGE. It follows `q` and ignores the
 * type/status filters and the page, so a dropdown built from it neither loses options on page 1 nor
 * collapses to the one type that is currently picked.
 */
export type PaginationMeta = components['schemas']['PaginationMetaDto']
export type ListFacets = components['schemas']['ListFacetsDto']
export type VenueTypeFacet = components['schemas']['VenueTypeFacetDto']

export type ListPage<T> = {
  data: T[]
  meta: PaginationMeta
  facets: ListFacets
}

/** Options for a type dropdown, in Thai order — Postgres collation is not a Thai collator. */
export function sortFacets(types: readonly VenueTypeFacet[]): VenueTypeFacet[] {
  return [...types].sort((a, b) => a.name.localeCompare(b.name, 'th'))
}

// ---------------------------------------------------------------------------
// DEV fixtures only — the `?gate=` override answers from memory and must answer in the SAME shape.
// ---------------------------------------------------------------------------

const DEV_TYPE_NAMES = [
  'หอประชุม',
  'โรงยิม',
  'ห้องประชุม',
  'ห้องเรียน',
  'ลานกิจกรรม',
  'สนามกีฬา',
  'ห้องปฏิบัติการ',
]

/**
 * A stable id per fixture category name. ⚠️ ONE ID PER NAME, NOT `1` FOR ALL: the type filter now
 * sends an id, so a fixture where every category shares one id would make the filter unreachable.
 */
export function devVenueTypeId(name: string): number {
  const i = DEV_TYPE_NAMES.indexOf(name)
  return i === -1 ? DEV_TYPE_NAMES.length + 1 : i + 1
}

/**
 * The server's envelope, built in memory. `rows` are already filtered and ordered; `searched` is the
 * set the facets come from — the rows matching `q` only, exactly as the endpoint computes them.
 */
export function devPage<T>(
  rows: readonly T[],
  searched: readonly { venueType: { id: number; name: string } }[],
  page: number,
  limit: number,
): ListPage<T> {
  const types = new Map<number, string>()
  for (const s of searched) types.set(s.venueType.id, s.venueType.name)
  return {
    data: rows.slice((page - 1) * limit, page * limit),
    meta: { page, limit, total: rows.length, totalPages: Math.ceil(rows.length / limit) },
    facets: { venueTypes: [...types].map(([id, name]) => ({ id, name })) },
  }
}

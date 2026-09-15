/**
 * The "โหลดเพิ่มเติม" control under a paginated LIFF list (`CLIENT-PAGINATION-1`).
 *
 * ⚠️ A BUTTON, NOT INFINITE SCROLL. An IntersectionObserver that fires as the reader nears the end
 * turns the bottom of the page into a place where content appears on its own, which is exactly where
 * the LIFF dock and a thumb already are. A button is one explicit tap and has a failure state it can
 * stand next to.
 *
 * ⚠️ `disabled` WHILE LOADING is the double-tap guard the reader can see; `usePagedList` holds a
 * second one in a ref, because a disabled attribute lands a render later than a fast second tap.
 *
 * ⚠️ `blocked` IS NOT `loading` (`ISSUE-QA-01`). It means the list above is being re-read from page 1
 * — a filter change or a live refresh — so an append now would be appended to rows that are about to
 * be replaced. The button is disabled WITHOUT a spinner: the reader did not ask for more, and a
 * spinner appearing on its own every time a socket event arrives would read as "something is loading
 * that I did not start".
 */
export function LoadMore({
  hasMore,
  loading,
  blocked = false,
  failure,
  onLoadMore,
}: {
  hasMore: boolean
  loading: boolean
  blocked?: boolean
  failure: string | null
  onLoadMore: () => void
}) {
  if (!hasMore) return null
  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      {failure ? (
        <p role="alert" className="text-center text-sm text-base-content/80">
          {failure}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onLoadMore}
        disabled={loading || blocked}
        aria-busy={loading}
        className="btn btn-app btn-outline min-w-44 gap-2"
      >
        {loading ? <span className="loading loading-spinner loading-sm" aria-hidden="true" /> : null}
        {failure ? 'ลองโหลดเพิ่มอีกครั้ง' : 'โหลดเพิ่มเติม'}
      </button>
    </div>
  )
}

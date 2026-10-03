/**
 * The A4 sheet: Hub 4's document, painted from the server's JSON model. Prototype `<article
 * data-rpe-sheet>` ~L8651–8678 and `paint()` ~L25758–25775.
 *
 * ⚠️ IT COMPUTES NOTHING. Every title line, table, cell and the footer arrive finished in
 * `ReportDocumentDto` (one server builder feeds both this sheet and the `.xlsx`, so paper and file
 * cannot disagree), and this component only lays them out. The only text it owns is the fixed
 * signature block, which is the prototype's verbatim.
 *
 * ⚠️ JSX, NEVER `innerHTML`. The prototype built rows as strings and ran them through `esc()`; here a
 * purpose that says `<script>` or `=1+1` is a text node. A user-typed colon in a purpose is DATA, so
 * the typesetting rule (no colon, dash or middle dot) binds only the strings the server composes.
 *
 * ⚠️ PAPER IS ALWAYS LIGHT. The article carries its own `data-theme="easybook-admin"`, so every daisyUI
 * token inside it (`bg-base-100`, `border-base-content/30`) resolves to the light theme in BOTH portal
 * themes, on screen and on paper, with no attribute swapped behind React's back on `beforeprint`.
 *
 * The `data-rpe-*` attributes are what `admin-portal.css` (C-3) selects for the pt sizes, and
 * `data-rpe-sheet` is what its print rule keys on: only a rendered sheet makes Ctrl+P print the page.
 */

import type { ReportDocAlign, ReportDocument } from '@/lib/api-client'

/** `ReportDocAlign` → the prototype's cell class (`.num`, `.c`, `.mono`, `.nowrap`; text has none). */
const ALIGN_CLASS: Record<ReportDocAlign, string | undefined> = {
  TEXT: undefined,
  NUM: 'num',
  CENTER: 'c',
  MONO: 'mono',
  NOWRAP: 'nowrap',
}

const SIGNATURES: readonly { who: string; position: string }[] = [
  { who: 'ผู้จัดทำรายงาน', position: 'เจ้าหน้าที่ฝ่ายบริหารงานทั่วไป' },
  { who: 'ผู้ตรวจสอบ', position: 'หัวหน้าฝ่ายบริหารงานทั่วไป' },
  { who: 'ผู้อนุมัติ/รับทราบ', position: 'ผู้อำนวยการโรงเรียนเทศบาลท่าโขลง 1' },
]

export function ReportSheet({ doc }: { doc: ReportDocument }) {
  const h = doc.header
  return (
    <article
      data-rpe-sheet
      data-theme="easybook-admin"
      className="rpe-doc mx-auto min-h-[297mm] max-w-[210mm] rounded-card border border-base-300 bg-base-100 p-5 text-base-content shadow-md sm:p-12 print:m-0 print:min-h-0 print:max-w-none print:rounded-none print:border-none print:p-0 print:shadow-none"
      aria-label="ตัวอย่างเอกสารรายงาน"
    >
      <header className="text-center">
        <p data-rpe-title className="rpe-doc-title">
          {h.title}
        </p>
        <p className="m-0">{h.school}</p>
        <p data-rpe-period className="m-0 font-semibold">
          {h.period}
        </p>
        <p data-rpe-kind className="m-0 mt-1">
          {h.kind}
        </p>
        <p data-rpe-date-range className="m-0 mt-1">
          {h.dateRange}
        </p>
        <p data-rpe-scope className="m-0 mt-0.5 text-base-content/80">
          {h.scope}
        </p>
      </header>
      <hr className="my-5 border-base-content/30" />

      <div data-rpe-body>
        {doc.sections.map((section, i) => {
          const colClass = (j: number) => ALIGN_CLASS[section.columns[j]?.align ?? 'TEXT']
          return (
            <section key={`${i}-${section.title}`} className="rpe-sec">
              <h3>
                {i + 1}. {section.title}
              </h3>
              <div className="rpe-scroll">
                <table>
                  <thead>
                    <tr>
                      {section.columns.map((c, j) => (
                        <th key={j} scope="col" className={colClass(j)}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.length > 0 ? (
                      section.rows.map((row, r) => (
                        <tr key={r}>
                          {row.cells.map((cell, j) => (
                            <td key={j} className={colClass(j)}>
                              {cell.text}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="c" colSpan={section.columns.length}>
                          {section.emptyText}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })}
      </div>

      {/* ── ส่วนลงนามรับรอง ── one column on a phone screen; three on anything wider and ALWAYS three
          on paper (`print:grid-cols-3`). */}
      <section
        className="rpe-sign mt-12 grid gap-8 sm:grid-cols-3 print:grid-cols-3"
        aria-label="ส่วนลงนามรับรองเอกสาร"
      >
        {SIGNATURES.map((s) => (
          <div key={s.who}>
            <p className="m-0 font-semibold">{s.who}</p>
            <p className="rpe-sign-line">
              <span>(ลงชื่อ)</span>
              <span className="rpe-dots" />
            </p>
            <p className="rpe-sign-line">
              <span>(</span>
              <span className="rpe-dots" />
              <span>)</span>
            </p>
            <p className="m-0 mt-1">{s.position}</p>
          </div>
        ))}
      </section>

      <p
        data-rpe-meta
        className="m-0 mt-10 border-t border-base-content/30 pt-2 text-[12px] text-base-content/70"
      >
        {doc.footer}
      </p>
    </article>
  )
}

/**
 * The A4 skeleton (prototype `[data-panel="loading"]` ~L8700): the sheet's own footprint, so the page
 * does not jump when the document arrives. A skeleton earns its place only by matching the shape.
 */
export function ReportSheetSkeleton() {
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">
        กำลังจัดทำเอกสาร
      </span>
      <div
        className="mx-auto min-h-[297mm] max-w-[210mm] rounded-card border border-base-300 bg-base-100 p-5 sm:p-12"
        aria-hidden="true"
      >
        <span className="sk mx-auto block h-5 w-2/3" />
        <span className="sk-soft mx-auto mt-3 block h-3.5 w-3/4" />
        <span className="sk-soft mx-auto mt-2 block h-3.5 w-1/2" />
        <span className="sk-box mt-10 block h-40 w-full" />
        <span className="sk-box mt-6 block h-56 w-full" />
      </div>
    </div>
  )
}

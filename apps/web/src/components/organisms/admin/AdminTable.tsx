import type { ReactNode } from 'react';

/** Scrollable admin table with an accessible caption (Fase 3B, shared since 4C). */
export function AdminTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: readonly string[];
  rows: readonly (readonly ReactNode[])[];
}): ReactNode {
  return (
    <div
      className="overflow-x-auto rounded-xl border border-line bg-surface"
      tabIndex={0}
      role="region"
      aria-label={caption}
    >
      <table className="w-full min-w-[36rem] text-left text-[14px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-2">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="p-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={head.length} className="p-3 text-ink-2">
                Belum ada data.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              // Rows have no stable id across the three tables; the order is fixed per response.
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className="p-3 align-top">
                    {c}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

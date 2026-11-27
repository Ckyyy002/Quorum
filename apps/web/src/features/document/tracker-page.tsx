import { useState } from 'react';
import { Link } from 'react-router';
import { Pager } from '@/components/pager';
import { ErrorText } from '@/features/org/org-forms';
import { formatDay } from '@/features/proker/labels';
import { FilterBar } from '@/features/search/filter-bar';
import { UnitFilters } from '@/features/search/unit-filters';
import {
  documentErrorMessage,
  STEP_LABEL,
  useTracker,
  type TrackerQuery,
  type TrackerRow,
} from './document-api';
import { DocumentStatusBadge } from './document-section';

/**
 * US-8.4: replaces the "SPS Tracker Proposal, SPJ, LPJ" sheet. One row per proker in my scope, nearest open
 * deadline first (the API sorts); a late row is marked so it stands out.
 */
export function TrackerPage() {
  const [query, setQuery] = useState<TrackerQuery>({ page: 1 });
  const tracker = useTracker(query);
  const filter = (patch: Partial<TrackerQuery>) => setQuery((q) => ({ ...q, ...patch, page: 1 }));

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Tracker proposal &amp; LPJ</h1>
        <p className="text-muted-foreground">
          Tahap dokumen tiap proker dan tenggat terdekat, diurutkan dari yang paling mendesak.
        </p>
      </div>

      <FilterBar
        search={{
          value: query.q ?? '',
          placeholder: 'Cari nama proker',
          onChange: (q) => filter({ q }),
        }}
        query={query}
        onReset={() => setQuery({ page: 1, q: query.q })}
      >
        <UnitFilters value={query} onChange={filter} />
      </FilterBar>

      {tracker.isError && <ErrorText>{documentErrorMessage(tracker.error)}</ErrorText>}
      {tracker.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Memuat…
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Proker</th>
                <th className="px-4 py-2.5 font-medium">Acara</th>
                <th className="px-4 py-2.5 font-medium">Proposal</th>
                <th className="px-4 py-2.5 font-medium">LPJ</th>
                <th className="px-4 py-2.5 font-medium">Tenggat berikutnya</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tracker.data?.data.map((row) => (
                <tr key={row.id} className={row.late ? 'bg-destructive/5' : undefined}>
                  <td className="px-4 py-2.5">
                    <Link to={`/proker/${row.id}`} className="font-semibold hover:underline">
                      {row.name}
                    </Link>
                    <div className="text-muted-foreground">{row.department.name}</div>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{formatDay(row.eventDate)}</td>
                  <td className="px-4 py-2.5">
                    <Stage doc={row.proposal} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Stage doc={row.lpj} />
                  </td>
                  <td className="px-4 py-2.5">
                    {row.nextDeadline ? (
                      <span className="flex flex-col">
                        <span>{STEP_LABEL[row.nextDeadline.step] ?? row.nextDeadline.step}</span>
                        <span className="text-muted-foreground">
                          {formatDay(row.nextDeadline.dueDate)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {row.late && (
                      <span className="mt-1 inline-block rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                        Terlambat
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {tracker.data?.data.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              Tidak ada proker di cakupanmu.
            </p>
          )}
        </div>
      )}
      <Pager meta={tracker.data?.meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
    </section>
  );
}

function Stage({ doc }: { doc: TrackerRow['proposal'] }) {
  if (!doc) return <span className="text-muted-foreground">Belum ada</span>;
  return (
    <Link to={`/dokumen/${doc.id}`}>
      <DocumentStatusBadge status={doc.status} />
    </Link>
  );
}

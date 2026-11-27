import { useState } from 'react';
import { Link } from 'react-router';
import { Pager } from '@/components/pager';
import { ErrorText, selectClass } from '@/features/org/org-forms';
import { formatDay, formatRupiah } from '@/features/proker/labels';
import { FilterBar, FilterField } from '@/features/search/filter-bar';
import { UnitFilters } from '@/features/search/unit-filters';
import {
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  documentErrorMessage,
  STATUS_LABEL,
  TYPE_LABEL,
  useDocumentSearch,
  type DocumentQuery,
} from './document-api';
import { DocumentStatusBadge } from './document-section';

/** US-8.2: proposals and LPJ of the active period; the API returns only what this user may see. */
export function DocumentSearchPage() {
  const [query, setQuery] = useState<DocumentQuery>({ page: 1 });
  const documents = useDocumentSearch(query);
  // Every filter change goes back to page 1, so the user never lands on an empty later page.
  const filter = (patch: Partial<DocumentQuery>) => setQuery((q) => ({ ...q, ...patch, page: 1 }));

  return (
    <section className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dokumen</h1>
        <p className="text-muted-foreground">
          Proposal dan LPJ periode aktif yang boleh kamu lihat.
        </p>
      </div>

      <FilterBar
        search={{
          value: query.q ?? '',
          placeholder: 'Cari judul dokumen',
          onChange: (q) => filter({ q }),
        }}
        query={query}
        onReset={() => setQuery({ page: 1, q: query.q })}
      >
        <FilterField label="Jenis">
          <select
            className={selectClass}
            value={query.type ?? ''}
            onChange={(e) =>
              filter({ type: (e.target.value || undefined) as DocumentQuery['type'] })
            }
          >
            <option value="">Proposal &amp; LPJ</option>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Status">
          <select
            className={selectClass}
            value={query.status ?? ''}
            onChange={(e) =>
              filter({ status: (e.target.value || undefined) as DocumentQuery['status'] })
            }
          >
            <option value="">Semua status</option>
            {DOCUMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </FilterField>
        <UnitFilters value={query} onChange={filter} />
        <label className="flex h-9 items-center gap-2 self-end text-sm">
          <input
            type="checkbox"
            checked={query.late === 'true'}
            onChange={(e) => filter({ late: e.target.checked ? 'true' : undefined })}
          />
          Hanya yang terlambat
        </label>
      </FilterBar>

      {documents.isError && <ErrorText>{documentErrorMessage(documents.error)}</ErrorText>}
      {documents.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Memuat…
        </p>
      ) : documents.data?.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada dokumen yang cocok.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {documents.data?.data.map((d) => (
            <li key={d.id}>
              <Link
                to={`/dokumen/${d.id}`}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-muted/50"
              >
                <span className="font-semibold">{d.title}</span>
                <span className="flex items-center gap-6 text-sm">
                  {/* Fixed widths: department, event day, amount and status each form one straight column. */}
                  <span className="w-44 truncate" title={d.proker.department.name}>
                    {d.proker.department.name}
                  </span>
                  <span className="w-32 tabular-nums">{formatDay(d.proker.eventDate)}</span>
                  <span className="w-36 text-right tabular-nums">
                    {formatRupiah(d.totalBudget)}
                  </span>
                  <span className="w-40">
                    <DocumentStatusBadge status={d.status} />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager meta={documents.data?.meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
    </section>
  );
}

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { Pager } from '@/components/pager';
import { useAuth } from '@/features/auth/auth-context';
import { ErrorText, selectClass } from '@/features/org/org-forms';
import { FilterBar, FilterField } from '@/features/search/filter-bar';
import { UnitFilters } from '@/features/search/unit-filters';
import { STATUS_LABEL, TYPE_LABEL } from './labels';
import { createsProkerIn } from './permissions';
import { ProkerTable } from './progress-table';
import {
  PROKER_STATUSES,
  PROKER_TYPES,
  prokerErrorMessage,
  useProkers,
  type ProkerQuery,
} from './proker-api';

/** Every proker of the active period (US-3.7, US-3.8). Guests see the same public summary. */
export function ProkerListPage() {
  const { state } = useAuth();
  const [query, setQuery] = useState<ProkerQuery>({ page: 1 });
  const prokers = useProkers(query);
  if (state.status !== 'authenticated') return null;
  const canCreate = createsProkerIn(state.user) !== null;
  // Every filter change goes back to page 1, so the user never lands on an empty later page.
  const filter = (patch: Partial<ProkerQuery>) => setQuery((q) => ({ ...q, ...patch, page: 1 }));
  const meta = prokers.data?.meta;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Proker</h1>
          <p className="text-muted-foreground">Program kerja periode aktif.</p>
        </div>
        {canCreate && (
          <Link to="/proker/baru" className={buttonVariants()}>
            <Plus /> Buat proker
          </Link>
        )}
      </div>

      <FilterBar
        search={{
          value: query.q ?? '',
          placeholder: 'Cari nama atau deskripsi proker',
          onChange: (q) => filter({ q }),
        }}
        query={query}
        onReset={() => setQuery({ page: 1, q: query.q })}
      >
        <FilterField label="Tipe">
          <select
            className={selectClass}
            value={query.type ?? ''}
            onChange={(e) => filter({ type: (e.target.value || undefined) as ProkerQuery['type'] })}
          >
            <option value="">Semua tipe</option>
            {PROKER_TYPES.map((t) => (
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
              filter({ status: (e.target.value || undefined) as ProkerQuery['status'] })
            }
          >
            <option value="">Semua status</option>
            {PROKER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </FilterField>
        <UnitFilters value={query} onChange={filter} />
      </FilterBar>

      {prokers.isError && <ErrorText>{prokerErrorMessage(prokers.error)}</ErrorText>}
      {prokers.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Memuat…
        </p>
      ) : (
        prokers.data && <ProkerTable prokers={prokers.data.data} showDepartment />
      )}

      <Pager meta={meta} onPage={(page) => setQuery((q) => ({ ...q, page }))} />
    </section>
  );
}

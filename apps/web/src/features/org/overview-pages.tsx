import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { ProkerTable } from '@/features/proker/progress-table';
import { prokerErrorMessage } from '@/features/proker/proker-api';
import { ErrorText } from './org-forms';
import {
  useBiroOverview,
  useDepartmentOverview,
  useKesekjenanOverview,
  type OverviewMember,
} from './org-api';
import { POSITION_LABEL } from './positions';

/** Shared loading/error handling: the API answers 403 when the overview is not the user's. */
function Loaded<T>({
  query,
  children,
}: {
  query: { isPending: boolean; isError: boolean; error: unknown; data?: T };
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Memuat…
      </p>
    );
  }
  if (query.isError || !query.data) return <ErrorText>{prokerErrorMessage(query.error)}</ErrorText>;
  return children(query.data);
}

function Title({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-bold tracking-[1.2px] text-muted-foreground">{eyebrow}</span>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
    </div>
  );
}

function Members({ members }: { members: OverviewMember[] }) {
  if (members.length === 0) {
    return <p className="text-sm font-semibold text-late-foreground">Belum diisi</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {members.map((m) => (
        <li key={m.id} className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm">
          <span className="font-semibold">{m.user.name}</span>{' '}
          <span className="text-muted-foreground">· {POSITION_LABEL[m.position]}</span>
        </li>
      ))}
    </ul>
  );
}

/** US-2.7: biros with their people and every proker of the department with checklist progress. */
export function DepartmentOverviewPage() {
  const { id } = useParams();
  const overview = useDepartmentOverview(id);
  return (
    <Loaded query={overview}>
      {(d) => (
        <section className="flex flex-col gap-6">
          <Title eyebrow={d.kesekjenan.name.toUpperCase()} title={d.name} />
          <Members members={d.memberships} />
          <div className="flex flex-col gap-3">
            <h2 className="text-xl font-bold">Proker</h2>
            <ProkerTable prokers={d.prokers} />
          </div>
          {d.biros.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-xl font-bold">Biro</h2>
              {d.biros.map((b) => (
                <div key={b.id} className="flex flex-col gap-2 rounded-xl border border-border p-4">
                  <Link to={`/unit/biro/${b.id}`} className="font-bold hover:underline">
                    {b.name}
                  </Link>
                  <Members members={b.memberships} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </Loaded>
  );
}

/** US-2.8: read-only, every department of the kesekjenan with its proker by stage and progress. */
export function KesekjenanOverviewPage() {
  const { id } = useParams();
  const { state } = useAuth();
  const overview = useKesekjenanOverview(id);
  // The Sekjen Bidang leads the special biro of their kesekjenan (Biro Personalia), so they create
  // its proker from here (US-6.5 AC2).
  const m = state.status === 'authenticated' ? state.user.membership : null;
  const leadsSpecialBiro = m?.roleGroup === 'SEKJEN_BIDANG' && m.kesekjenan?.id === id;

  return (
    <Loaded query={overview}>
      {(k) => (
        <section className="flex flex-col gap-6">
          <Title eyebrow={`PERIODE ${k.period.name}`} title={k.name} />
          {k.departments.map((d) => (
            <div key={d.id} className="flex flex-col gap-3 rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link to={`/unit/departemen/${d.id}`} className="text-lg font-bold hover:underline">
                  {d.name}
                </Link>
                {leadsSpecialBiro && d.kind === 'SPECIAL_BIRO' && (
                  <Link
                    to={`/proker/baru?departmentId=${d.id}`}
                    className={buttonVariants({ size: 'sm' })}
                  >
                    <Plus /> Buat proker
                  </Link>
                )}
              </div>
              <Members members={d.memberships} />
              <ProkerTable prokers={d.prokers} />
            </div>
          ))}
        </section>
      )}
    </Loaded>
  );
}

/** US-3.5: the proker a biro executes, the input for the monthly department meeting. */
export function BiroOverviewPage() {
  const { id } = useParams();
  const overview = useBiroOverview(id);
  return (
    <Loaded query={overview}>
      {(b) => (
        <section className="flex flex-col gap-6">
          <Title eyebrow={b.department.name.toUpperCase()} title={b.name} />
          <Members members={b.memberships} />
          <div className="flex flex-col gap-3">
            <h2 className="text-xl font-bold">Proker yang dijalankan</h2>
            <ProkerTable prokers={b.prokers} />
          </div>
        </section>
      )}
    </Loaded>
  );
}

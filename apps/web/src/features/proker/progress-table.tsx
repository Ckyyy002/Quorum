import { Link } from 'react-router';
import { cn } from '@/lib/utils';
import { formatDay, STATUS_LABEL, TYPE_LABEL } from './labels';
import type { Progress, ProkerProgress, ProkerStatus, ProkerSummary } from './proker-api';

const STATUS_CLASS: Record<ProkerStatus, string> = {
  PLANNED: 'bg-muted text-foreground',
  ONGOING: 'bg-chart-1/15 text-chart-1',
  DONE: 'bg-success/15 text-success',
  CANCELLED: 'bg-destructive/10 text-destructive',
};

export function StatusBadge({ status }: { status: ProkerStatus }) {
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_CLASS[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/** `3/13` with a bar, plus how many items are overdue (US-3.4 AC3). */
export function ProgressCell({ progress }: { progress: Progress }) {
  if (progress.total === 0) {
    return <span className="text-xs text-muted-foreground">Belum ada tanggal acara</span>;
  }
  const pct = Math.round((progress.done / progress.total) * 100);
  return (
    <div className="flex min-w-32 flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold">
          {progress.done}/{progress.total}
        </span>
        {progress.overdue > 0 && (
          <span className="font-semibold text-late-foreground">{progress.overdue} terlambat</span>
        )}
      </div>
      <div
        className="h-1.5 rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progress checklist"
      >
        <div className="h-full rounded-full bg-chart-1" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Proker table for the list page (summary only) and the overviews (with checklist progress). */
export function ProkerTable({
  prokers,
  showDepartment = false,
}: {
  prokers: (ProkerSummary | ProkerProgress)[];
  showDepartment?: boolean;
}) {
  if (prokers.length === 0) {
    return <p className="text-sm text-muted-foreground">Belum ada proker.</p>;
  }
  const withProgress = 'progress' in (prokers[0] ?? {});
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-semibold">Proker</th>
            {showDepartment && <th className="px-3 py-2 font-semibold">Departemen</th>}
            <th className="px-3 py-2 font-semibold">Biro</th>
            <th className="px-3 py-2 font-semibold">Tanggal (H)</th>
            <th className="px-3 py-2 font-semibold">Status</th>
            {withProgress && <th className="px-3 py-2 font-semibold">Checklist</th>}
          </tr>
        </thead>
        <tbody>
          {prokers.map((p) => (
            <tr key={p.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2">
                <Link to={`/proker/${p.id}`} className="font-semibold hover:underline">
                  {p.name}
                </Link>
                <div className="text-xs text-muted-foreground">{TYPE_LABEL[p.type]}</div>
              </td>
              {showDepartment && <td className="px-3 py-2">{p.department.name}</td>}
              <td className="px-3 py-2">{p.biro?.name ?? '—'}</td>
              <td className="px-3 py-2 whitespace-nowrap">{formatDay(p.eventDate)}</td>
              <td className="px-3 py-2">
                <StatusBadge status={p.status} />
              </td>
              {'progress' in p && (
                <td className="px-3 py-2">
                  <ProgressCell progress={p.progress} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

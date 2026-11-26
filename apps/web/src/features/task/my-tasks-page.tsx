import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { ErrorText } from '@/features/org/org-forms';
import { formatDay } from '@/features/proker/labels';
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  taskErrorMessage,
  useMyTaskCounts,
  useMyTasks,
  type TaskStatus,
} from './task-api';
import { FilterChip, OverdueBadge, TaskStatusBadge } from './task-badges';

type Filter = TaskStatus | 'ALL';

/** US-4.5: my tasks from every proker (and later meetings), nearest deadline first. */
export function MyTasksPage() {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [page, setPage] = useState(1);
  const tasks = useMyTasks({ ...(filter !== 'ALL' && { status: filter }), page });
  const counts = useMyTaskCounts();
  const meta = tasks.data?.meta;

  const choose = (next: Filter) => {
    setFilter(next);
    setPage(1);
  };

  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-3xl font-bold tracking-tight">Tugasku</h1>

      <div role="group" aria-label="Filter status" className="flex flex-wrap gap-2">
        <FilterChip
          label="Semua"
          count={counts.ALL}
          active={filter === 'ALL'}
          onClick={() => choose('ALL')}
        />
        {TASK_STATUSES.map((s) => (
          <FilterChip
            key={s}
            status={s}
            label={TASK_STATUS_LABEL[s]}
            count={counts[s]}
            active={filter === s}
            onClick={() => choose(s)}
          />
        ))}
      </div>

      {tasks.isError && <ErrorText>{taskErrorMessage(tasks.error)}</ErrorText>}
      {tasks.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Memuat…
        </p>
      ) : tasks.data?.data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Tidak ada tugas{filter !== 'ALL' && ` dengan status ${TASK_STATUS_LABEL[filter]}`}.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {tasks.data?.data.map((t) => (
            <li
              key={t.id}
              className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-x-4 px-4 py-3"
            >
              <TaskStatusBadge status={t.status} />
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-semibold">{t.title}</span>
                <span className="text-xs text-muted-foreground">
                  {t.proker ? (
                    <Link to={`/proker/${t.proker.id}`} className="hover:underline">
                      {t.proker.name}
                    </Link>
                  ) : (
                    'Tindak lanjut rapat'
                  )}{' '}
                  · Tenggat {formatDay(t.deadline)}
                </span>
              </div>
              {t.isOverdue ? <OverdueBadge /> : <span />}
            </li>
          ))}
        </ul>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Sebelumnya
          </Button>
          <span>
            Halaman {meta.page} dari {meta.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page >= meta.totalPages}
            onClick={() => setPage(page + 1)}
          >
            Berikutnya
          </Button>
        </div>
      )}
    </section>
  );
}

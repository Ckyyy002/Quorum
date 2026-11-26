import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { ErrorText, selectClass } from '@/features/org/org-forms';
import { formatDay } from '@/features/proker/labels';
import { cn } from '@/lib/utils';
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  taskErrorMessage,
  useMyTasks,
  type TaskStatus,
} from './task-api';

/** US-4.5: my tasks from every proker (and later meetings), nearest deadline first. */
export function MyTasksPage() {
  const [status, setStatus] = useState<TaskStatus | ''>('');
  const [page, setPage] = useState(1);
  const tasks = useMyTasks({ ...(status && { status }), page });
  const meta = tasks.data?.meta;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Tugasku</h1>
        <div className="flex flex-col gap-1">
          <label htmlFor="my-task-status" className="text-sm font-semibold">
            Status
          </label>
          <select
            id="my-task-status"
            className={cn(selectClass, 'w-auto')}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as TaskStatus | '');
              setPage(1);
            }}
          >
            <option value="">Semua</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {tasks.isError && <ErrorText>{taskErrorMessage(tasks.error)}</ErrorText>}
      {tasks.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Memuat…
        </p>
      ) : tasks.data?.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada tugas.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {tasks.data?.data.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">{t.title}</span>
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
              <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                {TASK_STATUS_LABEL[t.status]}
              </span>
              {t.isOverdue && (
                <span className="rounded-full bg-late px-2 py-0.5 text-xs font-semibold text-late-foreground">
                  Terlambat
                </span>
              )}
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

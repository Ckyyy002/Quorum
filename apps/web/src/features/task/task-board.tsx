import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorText, selectClass } from '@/features/org/org-forms';
import { dayInput, formatDay } from '@/features/proker/labels';
import { useProkerMembers, type ProkerDetail } from '@/features/proker/proker-api';
import { cn } from '@/lib/utils';
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  canMoveTask,
  taskErrorMessage,
  useCreateTask,
  useDeleteTask,
  useMoveTask,
  useProkerTasks,
  useSetTaskEvidence,
  useUpdateTask,
  type Task,
  type TaskStatus,
} from './task-api';
import { OverdueBadge } from './task-badges';
import { TaskForm } from './task-form';
import { EvidenceForm, EvidenceView } from '@/features/evidence/evidence-form';
import { hasEvidence } from '@/features/evidence/evidence';

/** The one button each column offers, so the board also works without drag-and-drop (keyboard). */
const MOVE_LABEL: Record<TaskStatus, { to: TaskStatus; label: string }> = {
  TODO: { to: 'IN_PROGRESS', label: 'Mulai' },
  IN_PROGRESS: { to: 'DONE', label: 'Selesai' },
  DONE: { to: 'IN_PROGRESS', label: 'Buka lagi' },
};

/**
 * US-4.4: TODO / IN_PROGRESS / DONE per proker. `canManage` = D, B or P (create, edit, delete, move any
 * task); everyone else may move only tasks assigned to them. The API checks every move again.
 */
export function TaskBoard(props: {
  proker: ProkerDetail;
  canManage: boolean;
  myMembershipId: string | undefined;
}) {
  const { proker: p, canManage } = props;
  const [assignee, setAssignee] = useState('');
  /** 'new' = the add form; a task id = that task's edit form. */
  const [form, setForm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The task whose "Selesai" opened the evidence form. */
  const [proving, setProving] = useState<string | null>(null);
  const setEvidence = useSetTaskEvidence();
  const tasks = useProkerTasks(p.id, assignee);
  // Members feed both the filter and the assignee picker.
  const members = useProkerMembers(p.id, true);
  const create = useCreateTask(p.id);
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const move = useMoveTask();

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(taskErrorMessage(e));
      return false;
    }
  };
  const mayMove = (t: Task) => canManage || t.assignee?.id === props.myMembershipId;
  /** DONE needs evidence: without it the card asks for a link or file first. */
  const moveTo = (t: Task, to: TaskStatus) => {
    if (to === 'DONE' && !hasEvidence(t)) {
      setError(null);
      setProving(t.id);
      return Promise.resolve(false);
    }
    return run(() => move.mutateAsync({ id: t.id, status: to }));
  };

  const onDrop = (e: DragEvent, to: TaskStatus) => {
    e.preventDefault();
    const task = tasks.data?.data.find((t) => t.id === e.dataTransfer.getData('text/plain'));
    if (!task || task.status === to) return;
    if (!canMoveTask(task.status, to)) {
      setError('Status harus berurutan: Belum mulai → Dikerjakan → Selesai.');
      return;
    }
    void moveTo(task, to);
  };

  const editing = tasks.data?.data.find((t) => t.id === form);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Tugas</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="task-assignee-filter" className="sr-only">
            Filter penanggung jawab
          </label>
          <select
            id="task-assignee-filter"
            className={cn(selectClass, 'w-auto')}
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
          >
            <option value="">Semua penanggung jawab</option>
            {members.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.user.name}
              </option>
            ))}
          </select>
          {canManage && form === null && (
            <Button onClick={() => setForm('new')}>
              <Plus /> Tambah tugas
            </Button>
          )}
        </div>
      </div>

      {form === 'new' && (
        <TaskForm
          idPrefix="new-task"
          members={members.data ?? []}
          submitLabel="Simpan"
          error={error}
          onCancel={() => setForm(null)}
          onSubmit={async (input) => {
            if (await run(() => create.mutateAsync(input))) setForm(null);
          }}
        />
      )}
      {editing && (
        <TaskForm
          key={editing.id}
          idPrefix={`task-${editing.id}`}
          members={members.data ?? []}
          defaultValues={{
            title: editing.title,
            description: editing.description,
            deadline: dayInput(editing.deadline),
            assigneeMembershipId: editing.assignee?.id ?? '',
          }}
          submitLabel="Simpan perubahan"
          error={error}
          onCancel={() => setForm(null)}
          onSubmit={async (input) => {
            // An unchanged deadline is not re-sent, so a task that is already late can still be edited.
            const deadline =
              input.deadline === dayInput(editing.deadline) ? undefined : input.deadline;
            if (await run(() => update.mutateAsync({ id: editing.id, ...input, deadline }))) {
              setForm(null);
            }
          }}
        />
      )}
      {form === null && proving === null && <ErrorText>{error}</ErrorText>}

      <div className="grid gap-3 md:grid-cols-3">
        {TASK_STATUSES.map((status) => {
          const column = tasks.data?.data.filter((t) => t.status === status) ?? [];
          return (
            <section
              key={status}
              aria-label={TASK_STATUS_LABEL[status]}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, status)}
              className="flex min-h-40 flex-col gap-2 rounded-xl border border-border bg-background p-3"
            >
              <h3 className="flex items-center justify-between text-sm font-bold">
                {TASK_STATUS_LABEL[status]}
                <span className="text-xs font-normal text-muted-foreground">{column.length}</span>
              </h3>
              {column.map((t) => (
                <article
                  key={t.id}
                  draggable={mayMove(t)}
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                  className={cn(
                    'flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3 text-sm',
                    mayMove(t) && 'cursor-grab',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold">{t.title}</span>
                    {t.isOverdue && <OverdueBadge />}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t.assignee?.user.name ?? 'Belum ada penanggung jawab'} · Tenggat{' '}
                    {formatDay(t.deadline)}
                  </span>
                  <EvidenceView evidence={t} filePath={`/tasks/${t.id}/evidence/file`} />
                  {proving === t.id && (
                    <EvidenceForm
                      idPrefix={`evidence-${t.id}`}
                      current={t}
                      submitLabel="Simpan & selesai"
                      error={error}
                      onCancel={() => setProving(null)}
                      onSubmit={async (input) => {
                        const ok = await run(async () => {
                          await setEvidence.mutateAsync({ id: t.id, ...input });
                          await move.mutateAsync({ id: t.id, status: 'DONE' });
                        });
                        if (ok) setProving(null);
                      }}
                    />
                  )}
                  <div className="flex flex-wrap items-center gap-1">
                    {mayMove(t) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void moveTo(t, MOVE_LABEL[t.status].to)}
                      >
                        {MOVE_LABEL[t.status].label}
                      </Button>
                    )}
                    {canManage && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Ubah ${t.title}`}
                          onClick={() => setForm(t.id)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Hapus ${t.title}`}
                          onClick={() => {
                            if (window.confirm(`Hapus tugas "${t.title}"?`)) {
                              void run(() => remove.mutateAsync(t.id));
                            }
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

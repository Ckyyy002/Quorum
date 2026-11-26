import { zodResolver } from '@hookform/resolvers/zod';
import { Check, ExternalLink, Pencil, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/features/auth/form-field';
import { ErrorText, selectClass } from '@/features/org/org-forms';
import { cn } from '@/lib/utils';
import { dayInput, formatDay } from './labels';
import { ProgressCell } from './progress-table';
import {
  prokerErrorMessage,
  useEditItem,
  useTickItem,
  useUntickItem,
  type ChecklistEdit,
  type ChecklistItem,
  type ProkerDetail,
} from './proker-api';

/**
 * US-3.4: generated checklist. Leaders in scope (D, B, P) mark items done, undo a mistaken tick, and
 * edit an item; a new label or due date keeps the item off the automatic re-scheduling.
 */
export function ChecklistSection({
  proker: p,
  canTick,
}: {
  proker: ProkerDetail;
  canTick: boolean;
}) {
  const tick = useTickItem(p.id);
  const untick = useUntickItem(p.id);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(prokerErrorMessage(e));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Checklist</h2>
        <ProgressCell progress={p.progress} />
      </div>
      {p.checklist.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Checklist dibuat otomatis setelah tanggal acara diisi.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {p.checklist.map((item) =>
            editing === item.key ? (
              <li key={item.id} className="p-4">
                <ItemForm prokerId={p.id} item={item} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-5 shrink-0 place-items-center rounded-full border',
                    item.doneAt ? 'border-success bg-success text-white' : 'border-border',
                  )}
                >
                  {item.doneAt && <Check className="size-3.5" />}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className={item.doneAt ? 'text-muted-foreground line-through' : ''}>
                    {item.label}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                    {item.doneAt
                      ? `Selesai ${formatDay(item.doneAt)}`
                      : `Tenggat ${formatDay(item.dueDate)}`}
                    {item.note && <span>· {item.note}</span>}
                    {item.evidenceUrl && (
                      <a
                        href={item.evidenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-primary hover:underline"
                      >
                        · Bukti <ExternalLink className="size-3" aria-hidden="true" />
                      </a>
                    )}
                  </span>
                </div>
                {item.overdue && (
                  <span className="rounded-full bg-late/15 px-2 py-0.5 text-xs font-semibold text-late-foreground">
                    Terlambat
                  </span>
                )}
                {canTick && (
                  <div className="flex items-center gap-1">
                    {item.doneAt ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void run(() => untick.mutateAsync(item.key))}
                      >
                        <Undo2 /> Batal
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void run(() => tick.mutateAsync(item.key))}
                      >
                        <Check /> Selesai
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Ubah ${item.label}`}
                      onClick={() => setEditing(item.key)}
                    >
                      <Pencil />
                    </Button>
                  </div>
                )}
              </li>
            ),
          )}
        </ul>
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

// Same limits as UpdateChecklistItemDto in the API.
const schema = z.object({
  label: z.string().trim().min(1, 'Wajib diisi').max(150, 'Maksimal 150 karakter'),
  dueDate: z.string(),
  note: z.string().trim().max(500, 'Maksimal 500 karakter'),
  evidenceUrl: z
    .string()
    .trim()
    .max(500, 'Maksimal 500 karakter')
    .refine((v) => v === '' || /^https?:\/\/\S+$/.test(v), 'Harus berupa link http(s)'),
});
type Values = z.infer<typeof schema>;

/** Only changed fields are sent, so editing a note does not pin the item's due date. */
function ItemForm(props: { prokerId: string; item: ChecklistItem; onDone: () => void }) {
  const { item } = props;
  const edit = useEditItem(props.prokerId);
  const [error, setError] = useState<string | null>(null);
  const initial: Values = {
    label: item.label,
    dueDate: dayInput(item.dueDate),
    note: item.note ?? '',
    evidenceUrl: item.evidenceUrl ?? '',
  };
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: initial });
  const id = (field: string) => `item-${item.key}-${field}`;

  const onSubmit = handleSubmit(async (values) => {
    const changed: ChecklistEdit = {};
    for (const field of Object.keys(values) as (keyof Values)[]) {
      if (values[field] !== initial[field]) changed[field] = values[field];
    }
    if (Object.keys(changed).length === 0) return props.onDone();
    setError(null);
    try {
      await edit.mutateAsync({ key: item.key, ...changed });
      props.onDone();
    } catch (e) {
      setError(prokerErrorMessage(e));
    }
  });

  return (
    <form noValidate className="flex flex-col gap-3" onSubmit={(e) => void onSubmit(e)}>
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <FormField id={id('label')} label="Nama item" error={errors.label?.message}>
          <Input id={id('label')} aria-invalid={!!errors.label} {...register('label')} />
        </FormField>
        <FormField id={id('dueDate')} label="Tenggat" hint="Jika diubah, tidak ikut bergeser">
          <Input id={id('dueDate')} type="date" {...register('dueDate')} />
        </FormField>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id={id('note')} label="Catatan" error={errors.note?.message}>
          <textarea
            id={id('note')}
            rows={2}
            className={selectClass + ' h-auto py-2'}
            {...register('note')}
          />
        </FormField>
        <FormField id={id('evidence')} label="Link bukti" error={errors.evidenceUrl?.message}>
          <Input
            id={id('evidence')}
            placeholder="https://…"
            aria-invalid={!!errors.evidenceUrl}
            {...register('evidenceUrl')}
          />
        </FormField>
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          Simpan
        </Button>
        <Button type="button" variant="outline" onClick={props.onDone}>
          Batal
        </Button>
      </div>
    </form>
  );
}

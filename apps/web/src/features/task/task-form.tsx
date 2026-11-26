import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/features/auth/form-field';
import { selectClass } from '@/features/org/org-forms';
import type { DepartmentMember } from '@/features/proker/proker-api';
import type { TaskInput } from './task-api';

// Same limits as the API DTO (apps/api/src/task/dto/task.dto.ts); the API also rejects a past deadline.
const schema = z.object({
  title: z.string().trim().min(1, 'Wajib diisi').max(150, 'Maksimal 150 karakter'),
  description: z.string().trim().max(2000, 'Maksimal 2000 karakter'),
  deadline: z.string().min(1, 'Wajib diisi'),
  assigneeMembershipId: z.string().min(1, 'Wajib dipilih'),
});

/** Title, description, deadline day (WIB) and assignee (an active member of the department). */
export function TaskForm(props: {
  idPrefix: string;
  members: DepartmentMember[];
  defaultValues?: TaskInput;
  submitLabel: string;
  error: string | null;
  onSubmit: (input: TaskInput) => Promise<unknown>;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TaskInput>({
    resolver: zodResolver(schema),
    defaultValues: props.defaultValues ?? {
      title: '',
      description: '',
      deadline: '',
      assigneeMembershipId: '',
    },
  });
  const id = (field: string) => `${props.idPrefix}-${field}`;

  return (
    <form
      noValidate
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      onSubmit={(e) => void handleSubmit((v) => props.onSubmit(v))(e)}
    >
      <FormField id={id('title')} label="Judul tugas" error={errors.title?.message}>
        <Input id={id('title')} aria-invalid={!!errors.title} {...register('title')} />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id={id('deadline')} label="Tenggat" error={errors.deadline?.message}>
          <Input
            id={id('deadline')}
            type="date"
            aria-invalid={!!errors.deadline}
            {...register('deadline')}
          />
        </FormField>
        <FormField
          id={id('assignee')}
          label="Penanggung jawab"
          error={errors.assigneeMembershipId?.message}
        >
          <select id={id('assignee')} className={selectClass} {...register('assigneeMembershipId')}>
            <option value="">Pilih…</option>
            {props.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.user.name}
                {m.biro && ` · ${m.biro.name}`}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <FormField id={id('description')} label="Deskripsi" error={errors.description?.message}>
        <textarea
          id={id('description')}
          rows={2}
          className={selectClass + ' h-auto py-2'}
          {...register('description')}
        />
      </FormField>
      {props.error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {props.error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {props.submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={props.onCancel}>
          Batal
        </Button>
      </div>
    </form>
  );
}

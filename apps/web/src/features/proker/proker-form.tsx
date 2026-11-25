import { zodResolver } from '@hookform/resolvers/zod';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/features/auth/form-field';
import { selectClass } from '@/features/org/org-forms';
import { TYPE_LABEL } from './labels';
import { PROKER_TYPES, type ProkerInput } from './proker-api';

// Same limits as the API DTO (apps/api/src/proker/dto/proker.dto.ts).
const schema = z.object({
  name: z.string().trim().min(1, 'Wajib diisi').max(120, 'Maksimal 120 karakter'),
  type: z.enum(PROKER_TYPES),
  eventDate: z.string(),
  // A number input gives a string; empty means "not set".
  estimatedBudget: z
    .string()
    .regex(/^\d*$/, 'Angka bulat tanpa titik')
    .refine((v) => v === '' || Number(v) <= 2_000_000_000, 'Terlalu besar'),
  description: z.string().trim().max(2000, 'Maksimal 2000 karakter'),
});
type Values = z.infer<typeof schema>;

export interface ProkerFormDefaults {
  name: string;
  type: ProkerInput['type'];
  eventDate: string;
  estimatedBudget: number;
  description: string;
}

/**
 * Name, type, event day (H, in WIB), budget and description. `children` adds fields only the create
 * screen has (executing biro, PIC); they are plain selects registered by the caller.
 */
export function ProkerForm(props: {
  idPrefix: string;
  defaultValues?: ProkerFormDefaults;
  submitLabel: string;
  error: string | null;
  onSubmit: (input: ProkerInput) => Promise<unknown>;
  onCancel?: () => void;
  children?: ReactNode;
}) {
  const d = props.defaultValues;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: d?.name ?? '',
      type: d?.type ?? 'AGENDA_MENENGAH',
      eventDate: d?.eventDate ?? '',
      estimatedBudget: d ? String(d.estimatedBudget) : '',
      description: d?.description ?? '',
    },
  });
  const id = (field: string) => `${props.idPrefix}-${field}`;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) =>
        void handleSubmit((v) =>
          props.onSubmit({
            name: v.name,
            type: v.type,
            description: v.description,
            // Omit what is empty so the API keeps "not set" instead of storing a blank.
            ...(v.eventDate && { eventDate: v.eventDate }),
            ...(v.estimatedBudget !== '' && { estimatedBudget: Number(v.estimatedBudget) }),
          }),
        )(e)
      }
    >
      <FormField id={id('name')} label="Nama proker" error={errors.name?.message}>
        <Input id={id('name')} aria-invalid={!!errors.name} {...register('name')} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id={id('type')} label="Tipe" error={errors.type?.message}>
          <select id={id('type')} className={selectClass} {...register('type')}>
            {PROKER_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          id={id('eventDate')}
          label="Tanggal acara (H)"
          hint="Checklist dibuat dari tanggal ini"
          error={errors.eventDate?.message}
        >
          <Input id={id('eventDate')} type="date" {...register('eventDate')} />
        </FormField>
        <FormField
          id={id('budget')}
          label="Estimasi anggaran (Rp)"
          error={errors.estimatedBudget?.message}
        >
          <Input
            id={id('budget')}
            inputMode="numeric"
            aria-invalid={!!errors.estimatedBudget}
            {...register('estimatedBudget')}
          />
        </FormField>
      </div>
      {props.children}
      <FormField id={id('description')} label="Deskripsi" error={errors.description?.message}>
        <textarea
          id={id('description')}
          rows={3}
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
        {props.onCancel && (
          <Button type="button" variant="outline" onClick={props.onCancel}>
            Batal
          </Button>
        )}
      </div>
    </form>
  );
}

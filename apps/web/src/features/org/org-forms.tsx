import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/features/auth/form-field';
import { cn } from '@/lib/utils';
import {
  orgErrorMessage,
  type DepartmentKind,
  type PeriodChoice,
  type PeriodInput,
  type UnitInput,
} from './org-api';

export const selectClass =
  'h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

export function ErrorText({ children }: { children: string | null }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  );
}

/**
 * Runs a submit and turns a thrown API error into a message, so each form keeps one error string.
 * Returns the wrapped handler plus the current message.
 */
function useSubmitError(conflict: string) {
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(orgErrorMessage(e, conflict));
    }
  };
  return { error, run };
}

// Same limits as the API DTOs (apps/api/src/org/dto/org.dto.ts); the API upper-cases the code.
const unitSchema = z.object({
  name: z.string().trim().min(2, 'Minimal 2 karakter').max(100, 'Maksimal 100 karakter'),
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{2,12}$/, '2–12 huruf atau angka, tanpa spasi'),
  kind: z.enum(['DEPARTMENT', 'SPECIAL_BIRO']),
});
type UnitValues = z.infer<typeof unitSchema>;

/** Name + code form for a kesekjenan, department or biro; `withKind` adds the department/special biro choice. */
export function UnitForm(props: {
  idPrefix: string;
  defaultValues?: UnitInput;
  withKind?: boolean;
  submitLabel: string;
  conflictMessage: string;
  onSubmit: (values: UnitInput & { kind: DepartmentKind }) => Promise<unknown>;
  onCancel: () => void;
}) {
  const { error, run } = useSubmitError(props.conflictMessage);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UnitValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: { name: '', code: '', kind: 'DEPARTMENT', ...props.defaultValues },
  });
  const id = (field: string) => `${props.idPrefix}-${field}`;

  return (
    <form
      noValidate
      onSubmit={(e) => void handleSubmit((values) => run(() => props.onSubmit(values)))(e)}
      className="flex flex-col gap-3"
    >
      <ErrorText>{error}</ErrorText>
      <FormField id={id('name')} label="Nama" error={errors.name?.message}>
        <Input id={id('name')} aria-invalid={!!errors.name} {...register('name')} />
      </FormField>
      <FormField
        id={id('code')}
        label="Kode"
        error={errors.code?.message}
        hint="Unik, misalnya SRD. Disimpan dalam huruf kapital."
      >
        <Input
          id={id('code')}
          aria-invalid={!!errors.code}
          className="font-mono uppercase"
          {...register('code')}
        />
      </FormField>
      {props.withKind && (
        <FormField id={id('kind')} label="Jenis">
          <select id={id('kind')} className={selectClass} {...register('kind')}>
            <option value="DEPARTMENT">Departemen</option>
            <option value="SPECIAL_BIRO">Biro khusus (tanpa biro di dalamnya)</option>
          </select>
        </FormField>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={props.onCancel}>
          Batal
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {props.submitLabel}
        </Button>
      </div>
    </form>
  );
}

const periodSchema = z
  .object({
    name: z.string().trim().min(3, 'Minimal 3 karakter').max(30, 'Maksimal 30 karakter'),
    startDate: z.iso.date('Pilih tanggal mulai'),
    endDate: z.iso.date('Pilih tanggal selesai'),
  })
  // ISO dates compare correctly as strings.
  .refine((v) => v.endDate > v.startDate, {
    path: ['endDate'],
    message: 'Harus setelah tanggal mulai',
  });

export function PeriodForm(props: {
  onSubmit: (values: PeriodInput) => Promise<unknown>;
  onCancel: () => void;
}) {
  const { error, run } = useSubmitError('Nama periode sudah dipakai.');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PeriodInput>({ resolver: zodResolver(periodSchema) });

  return (
    <form
      noValidate
      onSubmit={(e) => void handleSubmit((values) => run(() => props.onSubmit(values)))(e)}
      className="flex flex-col gap-3"
    >
      <ErrorText>{error}</ErrorText>
      <FormField
        id="period-name"
        label="Nama periode"
        error={errors.name?.message}
        hint="Misalnya 2027/2028"
      >
        <Input id="period-name" aria-invalid={!!errors.name} {...register('name')} />
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField id="period-start" label="Mulai" error={errors.startDate?.message}>
          <Input
            id="period-start"
            type="date"
            aria-invalid={!!errors.startDate}
            {...register('startDate')}
          />
        </FormField>
        <FormField id="period-end" label="Selesai" error={errors.endDate?.message}>
          <Input
            id="period-end"
            type="date"
            aria-invalid={!!errors.endDate}
            {...register('endDate')}
          />
        </FormField>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={props.onCancel}>
          Batal
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          Buat periode
        </Button>
      </div>
    </form>
  );
}

export function PeriodSelect(props: { choice: PeriodChoice; onChange?: () => void }) {
  const { periods, periodId, setPeriodId } = props.choice;
  if (!periods.data?.length) return null;
  return (
    <select
      aria-label="Periode"
      className={cn(selectClass, 'w-auto')}
      value={periodId}
      onChange={(e) => {
        setPeriodId(e.target.value);
        props.onChange?.();
      }}
    >
      {periods.data.map((p) => (
        <option key={p.id} value={p.id}>
          Periode {p.name}
          {p.isActive ? ' (aktif)' : ''}
        </option>
      ))}
    </select>
  );
}

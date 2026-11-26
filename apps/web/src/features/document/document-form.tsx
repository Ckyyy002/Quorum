import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/features/auth/form-field';
import { selectClass } from '@/features/org/org-forms';
import { MAX_EVIDENCE_BYTES } from '@/features/evidence/evidence';
import {
  DOCUMENT_ACCEPT,
  FUNDING_LABEL,
  FUNDING_SOURCES,
  type DocumentInput,
  type DocumentType,
  type FundingSource,
} from './document-api';

// Same limits as the API DTO (apps/api/src/document/dto/document.dto.ts).
const schema = z.object({
  title: z.string().trim().min(1, 'Wajib diisi').max(150, 'Maksimal 150 karakter'),
  totalBudget: z
    .string()
    .regex(/^\d+$/, 'Angka bulat tanpa titik')
    .refine((v) => Number(v) <= 2_000_000_000, 'Terlalu besar'),
  fundingSource: z.union([z.enum(FUNDING_SOURCES), z.literal('')]),
  file: z
    .custom<FileList>()
    .refine(
      (list) => !list?.[0] || list[0].size <= MAX_EVIDENCE_BYTES,
      'Ukuran file maksimal 10 MB',
    ),
});
type Values = z.infer<typeof schema>;

/**
 * Title, budget, funding source and an optional file (US-5.1). On edit, a chosen file becomes the next
 * version; leaving it empty keeps the current one.
 */
export function DocumentForm(props: {
  idPrefix: string;
  type: DocumentType;
  defaults?: { title: string; totalBudget: number; fundingSource: FundingSource | null };
  submitLabel: string;
  error: string | null;
  onSubmit: (input: DocumentInput) => Promise<unknown>;
  onCancel: () => void;
}) {
  const d = props.defaults;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: d?.title ?? '',
      totalBudget: String(d?.totalBudget ?? 0),
      fundingSource: d?.fundingSource ?? '',
    },
  });
  const id = (field: string) => `${props.idPrefix}-${field}`;
  const budgetLabel =
    props.type === 'PROPOSAL' ? 'Anggaran diajukan (Rp)' : 'Anggaran terealisasi (Rp)';

  return (
    <form
      noValidate
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
      onSubmit={(e) =>
        void handleSubmit((v) =>
          props.onSubmit({
            title: v.title,
            totalBudget: Number(v.totalBudget),
            ...(v.fundingSource && { fundingSource: v.fundingSource }),
            ...(v.file?.[0] && { file: v.file[0] }),
          }),
        )(e)
      }
    >
      <FormField id={id('title')} label="Judul" error={errors.title?.message}>
        <Input id={id('title')} aria-invalid={!!errors.title} {...register('title')} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={id('budget')} label={budgetLabel} error={errors.totalBudget?.message}>
          <Input
            id={id('budget')}
            inputMode="numeric"
            aria-invalid={!!errors.totalBudget}
            {...register('totalBudget')}
          />
        </FormField>
        <FormField id={id('funding')} label="Sumber dana" error={errors.fundingSource?.message}>
          <select id={id('funding')} className={selectClass} {...register('fundingSource')}>
            <option value="">Belum dipilih</option>
            {FUNDING_SOURCES.map((f) => (
              <option key={f} value={f}>
                {FUNDING_LABEL[f]}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <FormField
        id={id('file')}
        label={d ? 'File versi baru (opsional)' : 'File dokumen'}
        hint={`PDF atau DOCX, maksimal 10 MB.${d ? ' Versi lama tetap tersimpan.' : ''}`}
        error={errors.file?.message}
      >
        <Input id={id('file')} type="file" accept={DOCUMENT_ACCEPT} {...register('file')} />
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

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/features/auth/form-field';
import { ErrorText, selectClass } from '@/features/org/org-forms';
import { formatDateTime } from './labels';
import {
  prokerErrorMessage,
  useSaveEvaluation,
  type EvaluationInput,
  type ProkerDetail,
} from './proker-api';

const FIELDS = [
  { name: 'wentWell', label: 'Yang berjalan baik' },
  { name: 'toImprove', label: 'Yang perlu diperbaiki' },
  { name: 'problems', label: 'Masalah dan solusinya' },
  { name: 'recommendations', label: 'Rekomendasi untuk kabinet berikutnya' },
] as const;

const text = z.string().trim().min(1, 'Wajib diisi').max(5000, 'Maksimal 5000 karakter');
// Same rules as EvaluationDto on the API.
const schema = z.object({
  wentWell: text,
  toImprove: text,
  problems: text,
  recommendations: text,
  feedbackUrl: z.union([z.url('Masukkan link lengkap (https://…)').max(500), z.literal('')]),
});
type Values = z.infer<typeof schema>;

/** The event day (00:00 WIB) has started; the API answers 409 before it anyway. */
const eventStarted = (eventDate: string | null) =>
  !!eventDate && new Date(eventDate).getTime() <= Date.now();

/** US-3.10: read by every member (also in later periods); filled after the event by D, B and P. */
export function EvaluationSection({
  proker: p,
  canEdit,
}: {
  proker: ProkerDetail;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const e = p.evaluation;
  const mayFill = canEdit && eventStarted(p.eventDate);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Evaluasi pasca-acara</h2>
        {mayFill && !editing && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            {e ? 'Ubah evaluasi' : 'Isi evaluasi'}
          </Button>
        )}
      </div>
      {editing ? (
        <EvaluationForm proker={p} onDone={() => setEditing(false)} />
      ) : e ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-sm">
          {FIELDS.map((f) => (
            <div key={f.name} className="flex flex-col gap-0.5">
              <span className="font-semibold">{f.label}</span>
              <p className="whitespace-pre-line text-muted-foreground">{e[f.name]}</p>
            </div>
          ))}
          {e.feedbackUrl && (
            <a
              href={e.feedbackUrl}
              target="_blank"
              rel="noreferrer"
              className="self-start font-semibold text-primary hover:underline"
            >
              Form feedback peserta
            </a>
          )}
          <span className="text-xs text-muted-foreground">
            Diisi {e.filledBy.name}
            {e.updatedBy.id !== e.filledBy.id && `, terakhir diubah ${e.updatedBy.name}`} ·{' '}
            {formatDateTime(e.updatedAt)}
          </span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {eventStarted(p.eventDate)
            ? 'Belum ada evaluasi.'
            : 'Evaluasi bisa diisi mulai hari acara.'}
        </p>
      )}
    </div>
  );
}

function EvaluationForm({ proker: p, onDone }: { proker: ProkerDetail; onDone: () => void }) {
  const save = useSaveEvaluation(p.id);
  const [error, setError] = useState<string | null>(null);
  const e = p.evaluation;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      wentWell: e?.wentWell ?? '',
      toImprove: e?.toImprove ?? '',
      problems: e?.problems ?? '',
      recommendations: e?.recommendations ?? '',
      feedbackUrl: e?.feedbackUrl ?? '',
    },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
      onSubmit={(ev) =>
        void handleSubmit(async ({ feedbackUrl, ...rest }) => {
          setError(null);
          const input: EvaluationInput = { ...rest, ...(feedbackUrl && { feedbackUrl }) };
          try {
            await save.mutateAsync(input);
            onDone();
          } catch (err) {
            setError(prokerErrorMessage(err, 'Evaluasi baru bisa diisi mulai hari acara.'));
          }
        })(ev)
      }
    >
      {FIELDS.map((f) => (
        <FormField
          key={f.name}
          id={`eval-${f.name}`}
          label={f.label}
          error={errors[f.name]?.message}
        >
          <textarea
            id={`eval-${f.name}`}
            rows={3}
            className={selectClass + ' h-auto py-2'}
            aria-invalid={!!errors[f.name]}
            {...register(f.name)}
          />
        </FormField>
      ))}
      <FormField
        id="eval-feedback"
        label="Link form feedback (opsional)"
        error={errors.feedbackUrl?.message}
      >
        <Input
          id="eval-feedback"
          placeholder="https://forms.gle/…"
          aria-invalid={!!errors.feedbackUrl}
          {...register('feedbackUrl')}
        />
      </FormField>
      <p className="text-xs text-muted-foreground">
        Menyimpan evaluasi juga mencentang item &quot;Evaluasi&quot; di checklist.
      </p>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          Simpan evaluasi
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Batal
        </Button>
      </div>
    </form>
  );
}

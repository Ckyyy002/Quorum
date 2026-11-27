import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/features/auth/form-field';
import { ErrorText } from '@/features/org/org-forms';
import { dateTimeInput, fromDateTimeInput } from '@/features/proker/labels';
import type { MeetingDetail, MeetingFields } from './meeting-api';

const DAY_MS = 24 * 60 * 60 * 1000;

// Same limits as the API DTO (apps/api/src/meeting/dto/meeting.dto.ts). `keptStart` is the current start
// when editing: the API re-checks the 24-hour rule only for a new time, and so does the form.
const schemaFor = (keptStart: string) =>
  z
    .object({
      title: z.string().trim().min(1, 'Wajib diisi').max(150, 'Maksimal 150 karakter'),
      agenda: z
        .array(
          z.object({
            topic: z.string().trim().min(1, 'Wajib diisi').max(200, 'Maksimal 200 karakter'),
            expectedOutput: z
              .string()
              .trim()
              .min(1, 'Wajib diisi')
              .max(300, 'Maksimal 300 karakter'),
            materials: z.string().trim().max(500, 'Maksimal 500 karakter'),
          }),
        )
        .min(1, 'Minimal satu agenda')
        .max(20, 'Maksimal 20 agenda'),
      startsAt: z.string().min(1, 'Wajib diisi'),
      durationMin: z
        .string()
        .regex(/^\d+$/, 'Isi angka menit')
        .refine((v) => Number(v) >= 15 && Number(v) <= 600, '15–600 menit'),
      location: z.string().trim().min(1, 'Wajib diisi').max(300, 'Maksimal 300 karakter'),
      urgent: z.boolean(),
      urgentReason: z.string().trim().max(500, 'Maksimal 500 karakter'),
    })
    // The agenda rule (US-6.1 AC2), checked here too so the user sees it before sending.
    .superRefine((v, ctx) => {
      if (v.urgent && v.urgentReason.length < 10) {
        ctx.addIssue({ code: 'custom', path: ['urgentReason'], message: 'Minimal 10 karakter' });
      }
      if (!v.startsAt || v.startsAt === keptStart) return;
      const start = new Date(fromDateTimeInput(v.startsAt)).getTime();
      if (start <= Date.now()) {
        ctx.addIssue({ code: 'custom', path: ['startsAt'], message: 'Waktu rapat sudah lewat' });
      } else if (start - Date.now() < DAY_MS && !v.urgent) {
        ctx.addIssue({
          code: 'custom',
          path: ['startsAt'],
          message: 'Agenda harus dikirim 24 jam sebelumnya. Tandai mendesak jika memang perlu.',
        });
      }
    });

type Values = z.infer<ReturnType<typeof schemaFor>>;

const EMPTY_AGENDA = { topic: '', expectedOutput: '', materials: '' };

function toValues(m?: MeetingDetail): Values {
  return {
    title: m?.title ?? '',
    agenda: m?.agenda.map((a) => ({ ...a, materials: a.materials ?? '' })) ?? [EMPTY_AGENDA],
    startsAt: m ? dateTimeInput(m.startsAt) : '',
    durationMin: String(m?.durationMin ?? 90),
    location: m?.location ?? '',
    urgent: m?.urgent ?? false,
    urgentReason: m?.urgentReason ?? '',
  };
}

/**
 * Title, agenda (topic, expected output, materials), start in WIB, duration, place and the urgent flag.
 * `children` adds fields only the create page has (type and unit).
 */
export function MeetingForm(props: {
  idPrefix: string;
  meeting?: MeetingDetail;
  submitLabel: string;
  error: string | null;
  onSubmit: (input: MeetingFields) => Promise<unknown>;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schemaFor(props.meeting ? dateTimeInput(props.meeting.startsAt) : '')),
    defaultValues: toValues(props.meeting),
  });
  const agenda = useFieldArray({ control, name: 'agenda' });
  const urgent = useWatch({ control, name: 'urgent' });
  const id = (field: string) => `${props.idPrefix}-${field}`;

  return (
    <form
      noValidate
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5"
      onSubmit={(e) =>
        void handleSubmit((v) =>
          props.onSubmit({
            title: v.title,
            agenda: v.agenda.map((a) => ({ ...a, materials: a.materials || undefined })),
            startsAt: fromDateTimeInput(v.startsAt),
            durationMin: Number(v.durationMin),
            location: v.location,
            urgent: v.urgent,
            ...(v.urgent && { urgentReason: v.urgentReason }),
          }),
        )(e)
      }
    >
      {props.children}
      <FormField id={id('title')} label="Judul rapat" error={errors.title?.message}>
        <Input id={id('title')} aria-invalid={!!errors.title} {...register('title')} />
      </FormField>

      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <FormField id={id('startsAt')} label="Mulai (WIB)" error={errors.startsAt?.message}>
          <Input
            id={id('startsAt')}
            type="datetime-local"
            aria-invalid={!!errors.startsAt}
            {...register('startsAt')}
          />
        </FormField>
        <FormField id={id('duration')} label="Durasi (menit)" error={errors.durationMin?.message}>
          <Input
            id={id('duration')}
            inputMode="numeric"
            aria-invalid={!!errors.durationMin}
            {...register('durationMin')}
          />
        </FormField>
      </div>
      <FormField id={id('location')} label="Tempat atau link" error={errors.location?.message}>
        <Input id={id('location')} aria-invalid={!!errors.location} {...register('location')} />
      </FormField>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('urgent')} />
        Mendesak (dimulai kurang dari 24 jam lagi)
      </label>
      {urgent && (
        <FormField
          id={id('urgentReason')}
          label="Alasan mendesak"
          error={errors.urgentReason?.message}
        >
          <Input
            id={id('urgentReason')}
            aria-invalid={!!errors.urgentReason}
            {...register('urgentReason')}
          />
        </FormField>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="pb-1 text-sm font-semibold">Agenda</legend>
        {agenda.fields.map((field, i) => (
          <div
            key={field.id}
            className="grid gap-2 rounded-lg border border-border bg-background p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <FormField
              id={id(`topic-${i}`)}
              label="Topik"
              error={errors.agenda?.[i]?.topic?.message}
            >
              <Input id={id(`topic-${i}`)} {...register(`agenda.${i}.topic`)} />
            </FormField>
            <FormField
              id={id(`output-${i}`)}
              label="Output yang diharapkan"
              error={errors.agenda?.[i]?.expectedOutput?.message}
            >
              <Input id={id(`output-${i}`)} {...register(`agenda.${i}.expectedOutput`)} />
            </FormField>
            <FormField
              id={id(`materials-${i}`)}
              label="Bahan (opsional)"
              error={errors.agenda?.[i]?.materials?.message}
            >
              <Input id={id(`materials-${i}`)} {...register(`agenda.${i}.materials`)} />
            </FormField>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-end"
              aria-label={`Hapus agenda ${i + 1}`}
              disabled={agenda.fields.length === 1}
              onClick={() => agenda.remove(i)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        {errors.agenda?.root?.message && (
          <p className="text-sm text-destructive">{errors.agenda.root.message}</p>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={agenda.fields.length >= 20}
          onClick={() => agenda.append(EMPTY_AGENDA)}
        >
          <Plus className="size-4" /> Tambah agenda
        </Button>
      </fieldset>

      <ErrorText>{props.error}</ErrorText>
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Menyimpan…' : props.submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={props.onCancel}>
          Batal
        </Button>
      </div>
    </form>
  );
}

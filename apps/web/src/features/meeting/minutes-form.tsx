import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/features/auth/form-field';
import { ErrorText, selectClass } from '@/features/org/org-forms';
import type { MeetingDetail, MinutesInput } from './meeting-api';

// Same limits as the API DTO (apps/api/src/meeting/dto/minutes.dto.ts); the API also checks that every PIC
// is invited and no deadline is in the past (400).
const schema = z.object({
  summary: z.string().trim().min(1, 'Wajib diisi').max(5000, 'Maksimal 5000 karakter'),
  decisions: z
    .array(z.object({ text: z.string().trim().min(1, 'Wajib diisi').max(500, 'Maksimal 500') }))
    .max(50),
  carriedOver: z
    .array(z.object({ topic: z.string().trim().min(1, 'Wajib diisi').max(300, 'Maksimal 300') }))
    .max(50),
  nextActions: z
    .array(
      z.object({
        title: z.string().trim().min(1, 'Wajib diisi').max(150, 'Maksimal 150'),
        picMembershipId: z.string().min(1, 'Wajib dipilih'),
        deadline: z.string().min(1, 'Wajib diisi'),
      }),
    )
    .max(50),
});

/**
 * US-6.3 AC1: summary, decisions, carried-over items and next actions. When editing published minutes the
 * next actions are new ones only (existing ones are tasks now, edited on the task board).
 */
export function MinutesForm(props: {
  meeting: MeetingDetail;
  error: string | null;
  onSubmit: (input: MinutesInput) => Promise<unknown>;
  onCancel: () => void;
}) {
  const current = props.meeting.minutes;
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MinutesInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      summary: current?.summary ?? '',
      decisions: current?.decisions ?? [],
      carriedOver: current?.carriedOver ?? [],
      nextActions: [],
    },
  });
  const decisions = useFieldArray({ control, name: 'decisions' });
  const carriedOver = useFieldArray({ control, name: 'carriedOver' });
  const nextActions = useFieldArray({ control, name: 'nextActions' });

  return (
    <form
      noValidate
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5"
      onSubmit={(e) => void handleSubmit((v) => props.onSubmit(v))(e)}
    >
      <FormField id="minutes-summary" label="Ringkasan" error={errors.summary?.message}>
        <textarea
          id="minutes-summary"
          rows={4}
          aria-invalid={!!errors.summary}
          className={selectClass + ' h-auto py-2'}
          {...register('summary')}
        />
      </FormField>

      <ListField
        legend="Keputusan"
        addLabel="Tambah keputusan"
        count={decisions.fields.length}
        onAdd={() => decisions.append({ text: '' })}
      >
        {decisions.fields.map((f, i) => (
          <Row key={f.id} onRemove={() => decisions.remove(i)} label={`keputusan ${i + 1}`}>
            <FormField
              id={`decision-${i}`}
              label={`Keputusan ${i + 1}`}
              error={errors.decisions?.[i]?.text?.message}
            >
              <Input id={`decision-${i}`} {...register(`decisions.${i}.text`)} />
            </FormField>
          </Row>
        ))}
      </ListField>

      <ListField
        legend={current ? 'Tindak lanjut baru (jadi tugas)' : 'Tindak lanjut (jadi tugas)'}
        addLabel="Tambah tindak lanjut"
        count={nextActions.fields.length}
        onAdd={() => nextActions.append({ title: '', picMembershipId: '', deadline: '' })}
      >
        {nextActions.fields.map((f, i) => (
          <Row key={f.id} onRemove={() => nextActions.remove(i)} label={`tindak lanjut ${i + 1}`}>
            <div className="grid flex-1 gap-2 sm:grid-cols-[2fr_1.5fr_1fr]">
              <FormField
                id={`action-title-${i}`}
                label="Tindak lanjut"
                error={errors.nextActions?.[i]?.title?.message}
              >
                <Input id={`action-title-${i}`} {...register(`nextActions.${i}.title`)} />
              </FormField>
              <FormField
                id={`action-pic-${i}`}
                label="PIC"
                error={errors.nextActions?.[i]?.picMembershipId?.message}
              >
                {/* US-6.3 AC4: the PIC must be invited, so only invitees are offered. */}
                <select
                  id={`action-pic-${i}`}
                  className={selectClass}
                  {...register(`nextActions.${i}.picMembershipId`)}
                >
                  <option value="">Pilih…</option>
                  {props.meeting.invitations.map(({ membership: m }) => (
                    <option key={m.id} value={m.id}>
                      {m.user.name}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField
                id={`action-deadline-${i}`}
                label="Tenggat"
                error={errors.nextActions?.[i]?.deadline?.message}
              >
                <Input
                  id={`action-deadline-${i}`}
                  type="date"
                  {...register(`nextActions.${i}.deadline`)}
                />
              </FormField>
            </div>
          </Row>
        ))}
      </ListField>

      <ListField
        legend="Agenda yang dibawa ke rapat berikutnya"
        addLabel="Tambah agenda"
        count={carriedOver.fields.length}
        onAdd={() => carriedOver.append({ topic: '' })}
      >
        {carriedOver.fields.map((f, i) => (
          <Row key={f.id} onRemove={() => carriedOver.remove(i)} label={`agenda ${i + 1}`}>
            <FormField
              id={`carried-${i}`}
              label={`Agenda ${i + 1}`}
              error={errors.carriedOver?.[i]?.topic?.message}
            >
              <Input id={`carried-${i}`} {...register(`carriedOver.${i}.topic`)} />
            </FormField>
          </Row>
        ))}
      </ListField>

      <ErrorText>{props.error}</ErrorText>
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Menyimpan…' : current ? 'Simpan notulen' : 'Terbitkan notulen'}
        </Button>
        <Button type="button" variant="outline" onClick={props.onCancel}>
          Batal
        </Button>
      </div>
    </form>
  );
}

/** A fieldset of repeated rows with an "add" button (the API takes at most 50 of each). */
function ListField(props: {
  legend: string;
  addLabel: string;
  count: number;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-1 text-sm font-semibold">{props.legend}</legend>
      {props.children}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={props.count >= 50}
        onClick={props.onAdd}
      >
        <Plus className="size-4" /> {props.addLabel}
      </Button>
    </fieldset>
  );
}

function Row(props: { label: string; onRemove: () => void; children: ReactNode }) {
  return (
    <div className="flex items-end gap-2 [&>*:first-child]:flex-1">
      {props.children}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`Hapus ${props.label}`}
        onClick={props.onRemove}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

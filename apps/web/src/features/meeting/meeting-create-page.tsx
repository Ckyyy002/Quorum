import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '@/features/auth/auth-context';
import { FormField } from '@/features/auth/form-field';
import { usePeriods, useStructure } from '@/features/org/org-api';
import { ErrorText, selectClass } from '@/features/org/org-forms';
import { useProkers } from '@/features/proker/proker-api';
import {
  MEETING_TYPE_LABEL,
  MEETING_TYPES,
  meetingErrorMessage,
  useCreateMeeting,
  type MeetingType,
} from './meeting-api';
import { MeetingForm } from './meeting-form';
import { schedulableTypes, UNIT_FIELD } from './meeting-rights';

/**
 * US-6.1, 6.4–6.7. The types offered follow the member's position; the unit is their own (a PROKER meeting
 * picks the proker). Invitees are the type's defaults, worked out by the API.
 */
export function MeetingCreatePage() {
  const { state } = useAuth();
  const active = usePeriods().data?.find((p) => p.isActive);
  const structure = useStructure(active?.id).data;
  const me = state.status === 'authenticated' ? state.user : null;
  // A member's prokers are in their department; members without one (BPH) see the first page of all.
  const prokers = useProkers({ departmentId: me?.membership?.department?.id, page: 1 }).data?.data;
  const create = useCreateMeeting();
  const navigate = useNavigate();
  const [type, setType] = useState<MeetingType | ''>('');
  const [unitId, setUnitId] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!me) return null;
  if (!me.membership) {
    return <ErrorText>Hanya anggota kabinet periode aktif yang bisa menjadwalkan rapat.</ErrorText>;
  }
  const types = schedulableTypes(me, structure);
  const field = type ? UNIT_FIELD[type] : undefined;
  const units = type === 'PROKER' ? (prokers ?? []) : type ? (types[type] ?? []) : [];

  const chooseType = (next: MeetingType | '') => {
    setType(next);
    // Pre-pick the only unit (the member's own); a proker is always chosen by hand.
    const own = next && next !== 'PROKER' ? (types[next] ?? []) : [];
    setUnitId(own.length === 1 ? (own[0]?.id ?? '') : '');
  };

  return (
    <section className="flex max-w-4xl flex-col gap-5">
      <div>
        <Link to="/rapat" className="text-sm text-muted-foreground hover:underline">
          ← Rapat
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Jadwalkan rapat</h1>
        <p className="text-muted-foreground">
          Undangan dikirim ke peserta bawaan jenis rapat ini beserta agendanya.
        </p>
      </div>
      <MeetingForm
        idPrefix="new-meeting"
        submitLabel="Jadwalkan"
        error={error}
        onCancel={() => void navigate('/rapat')}
        onSubmit={async (fields) => {
          if (!type) return setError('Pilih jenis rapat.');
          if (field && !unitId) return setError('Pilih unit rapat.');
          setError(null);
          try {
            const created = await create.mutateAsync({
              ...fields,
              type,
              ...(field && { [field]: unitId }),
            });
            void navigate(`/rapat/${created.id}`);
          } catch (e) {
            setError(meetingErrorMessage(e));
          }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField id="new-meeting-type" label="Jenis rapat">
            <select
              id="new-meeting-type"
              className={selectClass}
              value={type}
              onChange={(e) => chooseType(e.target.value as MeetingType | '')}
            >
              <option value="">Pilih…</option>
              {MEETING_TYPES.filter((t) => t in types).map((t) => (
                <option key={t} value={t}>
                  {MEETING_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </FormField>
          {field && (
            <FormField id="new-meeting-unit" label={type === 'PROKER' ? 'Proker' : 'Unit'}>
              <select
                id="new-meeting-unit"
                className={selectClass}
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
              >
                <option value="">Pilih…</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}
        </div>
      </MeetingForm>
    </section>
  );
}

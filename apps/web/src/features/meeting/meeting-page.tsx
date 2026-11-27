import { ArrowLeft, Paperclip } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import type { Me } from '@/features/auth/auth-api';
import { useAuth } from '@/features/auth/auth-context';
import {
  downloadEvidence,
  EVIDENCE_ACCEPT,
  MAX_EVIDENCE_BYTES,
} from '@/features/evidence/evidence';
import { ErrorText } from '@/features/org/org-forms';
import { POSITION_LABEL } from '@/features/org/positions';
import { formatDateTime, formatDay } from '@/features/proker/labels';
import { TaskStatusBadge } from '@/features/task/task-badges';
import {
  MEETING_TYPE_LABEL,
  meetingErrorMessage,
  useCancelMeeting,
  useMeeting,
  useSaveMinutes,
  useSetMinutesFile,
  useUpdateMeeting,
  type MeetingDetail,
  unitName,
} from './meeting-api';
import { AttendanceSection } from './attendance-section';
import { MeetingForm } from './meeting-form';
import { MeetingStatusBadge } from './meeting-list-page';
import { meetingRights } from './meeting-rights';
import { MinutesForm } from './minutes-form';

/** US-6.2, 6.3, 6.8: one meeting — details, agenda, invitees, minutes and their next actions. */
export function MeetingPage() {
  const { id = '' } = useParams();
  const { state } = useAuth();
  const meeting = useMeeting(id);

  if (state.status !== 'authenticated') return null;
  if (meeting.isError) return <ErrorText>{meetingErrorMessage(meeting.error)}</ErrorText>;
  if (!meeting.data) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Memuat…
      </p>
    );
  }
  const m = meeting.data;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          to="/rapat"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" /> Rapat
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{m.title}</h1>
          <MeetingStatusBadge status={m.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {MEETING_TYPE_LABEL[m.type]} · {unitName(m)} · {formatDateTime(m.startsAt)} WIB ·{' '}
          {m.durationMin} menit · {m.location}
        </p>
        <p className="text-sm text-muted-foreground">
          Penyelenggara: {m.organizer.user.name} ({POSITION_LABEL[m.organizer.position]})
          {m.proker && (
            <>
              {' · '}
              <Link to={`/proker/${m.proker.id}`} className="hover:underline">
                Lihat proker
              </Link>
            </>
          )}
        </p>
        {m.urgent && (
          <p className="w-fit rounded-lg bg-late/15 px-3 py-1.5 text-sm text-late-foreground">
            Mendesak: {m.urgentReason}
          </p>
        )}
      </div>

      <Actions me={state.user} meeting={m} />

      <Panel title="Agenda">
        <ol className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {m.agenda.map((a, i) => (
            <li key={i} className="flex flex-col px-4 py-3">
              <span className="font-semibold">
                {i + 1}. {a.topic}
              </span>
              <span className="text-sm text-muted-foreground">
                Output: {a.expectedOutput}
                {a.materials && ` · Bahan: ${a.materials}`}
              </span>
            </li>
          ))}
        </ol>
      </Panel>

      <AttendanceSection me={state.user} meeting={m} />
      <Minutes me={state.user} meeting={m} />
    </section>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </div>
  );
}

/** US-6.2: the organizer reschedules or cancels before the start; a cancel asks once more inline. */
function Actions({ me, meeting }: { me: Me; meeting: MeetingDetail }) {
  const rights = meetingRights(me, meeting);
  const update = useUpdateMeeting(meeting.id);
  const cancel = useCancelMeeting(meeting.id);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!rights.change) return null;
  if (editing) {
    return (
      <MeetingForm
        idPrefix="edit-meeting"
        meeting={meeting}
        submitLabel="Simpan perubahan"
        error={error}
        onCancel={() => setEditing(false)}
        onSubmit={async ({ startsAt, ...fields }) => {
          setError(null);
          // Send the start only when it moved: the API re-checks the 24-hour rule for a new time.
          const moved = new Date(startsAt).getTime() !== new Date(meeting.startsAt).getTime();
          try {
            await update.mutateAsync({ ...fields, ...(moved && { startsAt }) });
            setEditing(false);
          } catch (e) {
            setError(meetingErrorMessage(e));
          }
        }}
      />
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setEditing(true)}>
          Ubah jadwal / agenda
        </Button>
        {confirming ? (
          <>
            <Button
              variant="destructive"
              disabled={cancel.isPending}
              onClick={() =>
                void cancel.mutateAsync(undefined).catch((e: unknown) => {
                  setError(meetingErrorMessage(e));
                  setConfirming(false);
                })
              }
            >
              Ya, batalkan rapat
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Tidak
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={() => setConfirming(true)}>
            Batalkan rapat
          </Button>
        )}
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

/** US-6.3: the published minutes, the form to write or edit them, the file and the next-action tasks. */
function Minutes({ me, meeting }: { me: Me; meeting: MeetingDetail }) {
  const rights = meetingRights(me, meeting);
  const minutes = meeting.minutes;
  const save = useSaveMinutes(meeting.id, !!minutes);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!minutes && !rights.minutes) {
    if (meeting.status === 'CANCELLED') return null;
    return (
      <Panel title="Notulen">
        <p className="text-sm text-muted-foreground">Notulen ditulis setelah rapat dimulai.</p>
      </Panel>
    );
  }

  if (writing) {
    return (
      <Panel title="Notulen">
        <MinutesForm
          meeting={meeting}
          error={error}
          onCancel={() => setWriting(false)}
          onSubmit={async (input) => {
            setError(null);
            try {
              await save.mutateAsync(input);
              setWriting(false);
            } catch (e) {
              setError(meetingErrorMessage(e, 'Notulen sudah terbit atau rapat dibatalkan.'));
            }
          }}
        />
      </Panel>
    );
  }

  if (!minutes) {
    return (
      <Panel title="Notulen">
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-border p-4">
          <p className="text-sm text-muted-foreground">
            {rights.minutesLate
              ? 'Sudah lewat 24 jam setelah rapat selesai; notulen akan ditandai terlambat.'
              : `Terbitkan notulen paling lambat ${formatDateTime(rights.minutesDueAt)} WIB.`}
          </p>
          <Button onClick={() => setWriting(true)}>Tulis notulen</Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Notulen">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">
          Diterbitkan {formatDateTime(minutes.publishedAt)} WIB oleh {minutes.author.name}
          {minutes.late && (
            <span className="ml-2 rounded-full bg-late/15 px-2 py-0.5 font-semibold text-late-foreground">
              Terlambat
            </span>
          )}
        </p>
        <p className="text-sm whitespace-pre-line">{minutes.summary}</p>
        <TextList title="Keputusan" items={minutes.decisions.map((d) => d.text)} />
        <TextList
          title="Dibawa ke rapat berikutnya"
          items={minutes.carriedOver.map((c) => c.topic)}
        />
        <MinutesFile meeting={meeting} canUpload={rights.minutes} />
        {rights.minutes && (
          <Button variant="outline" className="self-start" onClick={() => setWriting(true)}>
            Ubah notulen / tambah tindak lanjut
          </Button>
        )}
      </div>

      <h3 className="font-bold">Tindak lanjut</h3>
      {meeting.tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada tindak lanjut.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {meeting.tasks.map((t) => (
            <li
              key={t.id}
              className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-x-4 px-4 py-3"
            >
              <TaskStatusBadge status={t.status} />
              <span className="font-semibold">{t.title}</span>
              <span className="text-xs text-muted-foreground">
                {t.assignee?.user.name ?? 'Belum ada PIC'} · Tenggat {formatDay(t.deadline)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function TextList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-semibold">{title}</span>
      <ul className="list-disc pl-5 text-sm">
        {items.map((text, i) => (
          <li key={i}>{text}</li>
        ))}
      </ul>
    </div>
  );
}

/** The optional minutes file (US-6.3 AC1): download for everyone who sees the meeting, replace for the organizer. */
function MinutesFile({ meeting, canUpload }: { meeting: MeetingDetail; canUpload: boolean }) {
  const upload = useSetMinutesFile(meeting.id);
  const [error, setError] = useState<string | null>(null);
  const file = meeting.minutes?.file;
  const path = `/meetings/${meeting.id}/minutes/file`;

  const pick = (chosen: File | undefined) => {
    if (!chosen) return;
    if (chosen.size > MAX_EVIDENCE_BYTES) return setError('Ukuran file maksimal 10 MB.');
    setError(null);
    upload.mutateAsync(chosen).catch((e: unknown) => setError(meetingErrorMessage(e)));
  };

  if (!file && !canUpload) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {file && (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-primary hover:underline"
          onClick={() =>
            void downloadEvidence(path, file.originalName).catch(() =>
              setError('Gagal mengunduh file.'),
            )
          }
        >
          <Paperclip className="size-4" aria-hidden="true" /> {file.originalName}
        </button>
      )}
      {canUpload && (
        <label className="cursor-pointer text-primary hover:underline">
          {upload.isPending ? 'Mengunggah…' : file ? 'Ganti file' : 'Lampirkan file notulen'}
          <input
            type="file"
            accept={EVIDENCE_ACCEPT}
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </label>
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

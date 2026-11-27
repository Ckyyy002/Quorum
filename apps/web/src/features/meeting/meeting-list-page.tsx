import { CalendarPlus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Pager } from '@/components/pager';
import { buttonVariants } from '@/components/ui/button';
import { ErrorText } from '@/features/org/org-forms';
import { formatDateTime } from '@/features/proker/labels';
import { FilterChip } from '@/features/task/task-badges';
import { cn } from '@/lib/utils';
import {
  MEETING_STATUS_LABEL,
  MEETING_TYPE_LABEL,
  meetingErrorMessage,
  useMyMeetings,
  type MeetingStatus,
  type Range,
  unitName,
} from './meeting-api';

const STATUS_STYLE: Record<MeetingStatus, string> = {
  SCHEDULED: 'bg-primary/10 text-primary',
  CANCELLED: 'bg-muted text-muted-foreground line-through',
  DONE: 'bg-success/15 text-success',
};

export function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        STATUS_STYLE[status],
      )}
    >
      {MEETING_STATUS_LABEL[status]}
    </span>
  );
}

/** US-6.8: meetings I organize or am invited to; upcoming nearest first, past latest first. */
export function MeetingListPage() {
  const [range, setRange] = useState<Range>('upcoming');
  const [page, setPage] = useState(1);
  const meetings = useMyMeetings({ range, page });

  const choose = (next: Range) => {
    setRange(next);
    setPage(1);
  };

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">Rapat</h1>
        <Link to="/rapat/baru" className={buttonVariants()}>
          <CalendarPlus className="size-4" /> Jadwalkan rapat
        </Link>
      </div>

      <div role="group" aria-label="Rentang waktu" className="flex gap-2">
        <FilterChip
          label="Akan datang"
          count={undefined}
          active={range === 'upcoming'}
          onClick={() => choose('upcoming')}
        />
        <FilterChip
          label="Sudah lewat"
          count={undefined}
          active={range === 'past'}
          onClick={() => choose('past')}
        />
      </div>

      {meetings.isError && <ErrorText>{meetingErrorMessage(meetings.error)}</ErrorText>}
      {meetings.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Memuat…
        </p>
      ) : meetings.data?.data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {range === 'upcoming' ? 'Belum ada rapat terjadwal.' : 'Belum ada rapat yang lewat.'}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {meetings.data?.data.map((m) => (
            <li key={m.id}>
              <Link
                to={`/rapat/${m.id}`}
                className="grid grid-cols-[9rem_1fr_auto] items-center gap-x-4 px-4 py-3 hover:bg-accent"
              >
                <span className="text-sm font-semibold">{formatDateTime(m.startsAt)}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold">{m.title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {MEETING_TYPE_LABEL[m.type]} · {unitName(m)} · {m.location}
                    {m.agenda[0] && ` · ${m.agenda[0].topic}`}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  {m.hasMinutes && (
                    <span className="text-xs font-semibold text-success">Notulen ✓</span>
                  )}
                  <MeetingStatusBadge status={m.status} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager meta={meetings.data?.meta} onPage={setPage} />
    </section>
  );
}

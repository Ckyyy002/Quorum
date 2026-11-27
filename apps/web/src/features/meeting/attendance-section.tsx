import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Me } from '@/features/auth/auth-api';
import { ErrorText } from '@/features/org/org-forms';
import { cn } from '@/lib/utils';
import {
  meetingErrorMessage,
  useMarkAttendance,
  useOpenAttendance,
  useQrToken,
  type AttendanceStatus,
  type MeetingDetail,
} from './meeting-api';
import { meetingRights } from './meeting-rights';

const STATUS_LABEL: Record<AttendanceStatus | 'ABSENT', string> = {
  PRESENT: 'Hadir',
  EXCUSED: 'Izin',
  ABSENT: 'Belum hadir',
};

const STATUS_STYLE: Record<AttendanceStatus | 'ABSENT', string> = {
  PRESENT: 'bg-success/15 text-success',
  EXCUSED: 'bg-late/15 text-late-foreground',
  ABSENT: 'bg-muted text-muted-foreground',
};

/**
 * US-7: the organizer opens attendance and shows a QR that refreshes itself; everyone who sees the meeting
 * sees the recap (US-7.4). The QR holds a link to /rapat/:id/hadir, so members scan it with their phone camera.
 */
export function AttendanceSection({ me, meeting }: { me: Me; meeting: MeetingDetail }) {
  const rights = meetingRights(me, meeting);
  const toggle = useOpenAttendance(meeting.id, !meeting.attendanceOpen);
  const mark = useMarkAttendance(meeting.id);
  const qr = useQrToken(meeting.id, rights.attendance && meeting.attendanceOpen);
  const [error, setError] = useState<string | null>(null);

  if (meeting.status === 'CANCELLED') return null;
  const byMember = new Map(meeting.attendances.map((a) => [a.membershipId, a]));
  const count = (s: AttendanceStatus) => meeting.attendances.filter((a) => a.status === s).length;
  const present = count('PRESENT');
  const excused = count('EXCUSED');
  const absent = meeting.invitations.length - present - excused;

  const run = (fn: () => Promise<unknown>) => {
    setError(null);
    fn().catch((e: unknown) =>
      setError(meetingErrorMessage(e, 'Presensi baru bisa dibuka 30 menit sebelum rapat.')),
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold">Presensi</h2>
        <span className="text-sm text-muted-foreground">
          {present} hadir · {excused} izin · {absent} belum
        </span>
        {rights.attendance && (
          <Button
            size="sm"
            variant={meeting.attendanceOpen ? 'outline' : 'default'}
            disabled={toggle.isPending}
            onClick={() => run(() => toggle.mutateAsync(undefined))}
          >
            {meeting.attendanceOpen ? 'Tutup presensi' : 'Buka presensi QR'}
          </Button>
        )}
      </div>
      <ErrorText>{error}</ErrorText>

      {rights.attendance && meeting.attendanceOpen && qr.data && (
        <div className="flex flex-col items-center gap-2 self-start rounded-xl border border-border bg-white p-5">
          <QRCodeSVG
            value={`${window.location.origin}/rapat/${meeting.id}/hadir?t=${encodeURIComponent(qr.data.token)}`}
            size={240}
            marginSize={2}
            title="QR presensi"
          />
          <span className="text-xs text-muted-foreground">
            Pindai dengan kamera HP · QR berganti otomatis tiap 30 detik
          </span>
        </div>
      )}

      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {meeting.invitations.map(({ membership: p }) => {
          const a = byMember.get(p.id);
          const status = a?.status ?? 'ABSENT';
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
              <span className="flex-1 text-sm font-medium">{p.user.name}</span>
              {a?.note && <span className="text-xs text-muted-foreground">{a.note}</span>}
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  STATUS_STYLE[status],
                )}
              >
                {STATUS_LABEL[status]}
                {a && ` · ${a.method === 'QR' ? 'QR' : 'manual'}`}
              </span>
              {rights.attendance && (
                <span className="flex gap-1">
                  {(['PRESENT', 'EXCUSED'] as const)
                    .filter((s) => s !== a?.status)
                    .map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant="ghost"
                        disabled={mark.isPending}
                        onClick={() =>
                          run(() => mark.mutateAsync({ membershipId: p.id, status: s }))
                        }
                      >
                        Tandai {STATUS_LABEL[s].toLowerCase()}
                      </Button>
                    ))}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

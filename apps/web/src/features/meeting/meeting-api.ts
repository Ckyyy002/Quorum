import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paginated } from '@/features/org/org-api';
import type { EvidenceFile } from '@/features/evidence/evidence';
import type { Person } from '@/features/proker/proker-api';
import type { TaskStatus } from '@/features/task/task-api';
import { api, errorMessage } from '@/lib/api';

// Shapes mirror the API responses (apps/api/src/meeting); only the fields the screens read are listed.
export const MEETING_TYPES = [
  'BPH',
  'KESEKJENAN',
  'KABINET',
  'DEPARTEMEN',
  'BIRO',
  'PROKER',
] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];
export type MeetingStatus = 'SCHEDULED' | 'CANCELLED' | 'DONE';

export const MEETING_TYPE_LABEL: Record<MeetingType, string> = {
  BPH: 'Rapat BPH',
  KESEKJENAN: 'Rapat kesekjenan',
  KABINET: 'Rapat kabinet',
  DEPARTEMEN: 'Rapat departemen',
  BIRO: 'Rapat biro',
  PROKER: 'Rapat proker',
};

export const MEETING_STATUS_LABEL: Record<MeetingStatus, string> = {
  SCHEDULED: 'Terjadwal',
  CANCELLED: 'Dibatalkan',
  DONE: 'Selesai',
};

export interface AgendaItem {
  topic: string;
  expectedOutput: string;
  materials?: string;
}

type UnitRef = { id: string; name: string } | null;

export interface MeetingSummary {
  id: string;
  type: MeetingType;
  title: string;
  startsAt: string;
  durationMin: number;
  location: string;
  status: MeetingStatus;
  urgent: boolean;
  kesekjenan: UnitRef;
  department: UnitRef;
  biro: UnitRef;
  proker: UnitRef;
  organizer: Person;
}

/** US-6.8 row: my attendance (filled by US-7) and whether minutes are out. */
export interface MyMeeting extends MeetingSummary {
  agenda: AgendaItem[];
  myAttendance: string | null;
  hasMinutes: boolean;
}

export interface Minutes {
  summary: string;
  decisions: { text: string }[];
  carriedOver: { topic: string }[];
  publishedAt: string;
  late: boolean;
  updatedAt: string;
  author: { id: string; name: string };
  file: EvidenceFile | null;
}

export type AttendanceStatus = 'PRESENT' | 'EXCUSED';

export interface Attendance {
  membershipId: string;
  status: AttendanceStatus;
  method: 'QR' | 'MANUAL';
  checkedInAt: string;
  note: string | null;
}

export interface MeetingDetail extends MeetingSummary {
  agenda: AgendaItem[];
  urgentReason: string | null;
  attendanceOpen: boolean;
  /** US-7.4: invitees without a row are absent. */
  attendances: Attendance[];
  invitations: { optional: boolean; membership: Person }[];
  minutes: Minutes | null;
  tasks: {
    id: string;
    title: string;
    deadline: string;
    status: TaskStatus;
    assignee: Person | null;
  }[];
}

export interface MeetingInput {
  type: MeetingType;
  title: string;
  agenda: AgendaItem[];
  startsAt: string;
  durationMin: number;
  location: string;
  urgent?: boolean;
  urgentReason?: string;
  kesekjenanId?: string;
  departmentId?: string;
  biroId?: string;
  prokerId?: string;
}

/** What the shared form edits; the create body adds the type and unit. */
export type MeetingFields = Pick<
  MeetingInput,
  'title' | 'agenda' | 'startsAt' | 'durationMin' | 'location' | 'urgent' | 'urgentReason'
>;

export interface NextActionInput {
  title: string;
  picMembershipId: string;
  deadline: string;
}

export interface MinutesInput {
  summary: string;
  decisions: { text: string }[];
  carriedOver: { topic: string }[];
  nextActions: NextActionInput[];
}

export type Range = 'upcoming' | 'past';

/** The unit a meeting belongs to, for subtitles; BPH and Kabinet have none. */
export const unitName = (m: MeetingSummary) =>
  m.proker?.name ?? m.biro?.name ?? m.department?.name ?? m.kesekjenan?.name ?? 'HMTC';

// ── Queries ──
export const useMyMeetings = (query: { range: Range; page: number }) =>
  useQuery({
    queryKey: ['meetings', 'mine', query],
    queryFn: async () =>
      (await api.get<Paginated<MyMeeting>>('/me/meetings', { params: { ...query, limit: 20 } }))
        .data,
    placeholderData: keepPreviousData,
  });

export const useMeeting = (id: string) =>
  useQuery({
    queryKey: ['meetings', id],
    queryFn: async () => (await api.get<MeetingDetail>(`/meetings/${id}`)).data,
    // While attendance is open, the recap follows check-ins as they come in.
    refetchInterval: (query) => (query.state.data?.attendanceOpen ? 10_000 : false),
  });

// ── Mutations ──
/** Minutes add tasks, so every meeting write also refreshes the task lists (Tugasku, boards). */
function useMeetingMutation<TInput>(fn: (input: TInput) => Promise<{ data: MeetingDetail }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TInput) => (await fn(input)).data,
    onSuccess: () =>
      Promise.all(
        ['meetings', 'tasks', 'my-tasks'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      ),
  });
}

export const useCreateMeeting = () =>
  useMeetingMutation((input: MeetingInput) => api.post<MeetingDetail>('/meetings', input));

export const useUpdateMeeting = (id: string) =>
  useMeetingMutation((input: Partial<MeetingFields>) =>
    api.patch<MeetingDetail>(`/meetings/${id}`, input),
  );

export const useCancelMeeting = (id: string) =>
  useMeetingMutation(() => api.post<MeetingDetail>(`/meetings/${id}/cancel`));

/** First publish (POST) or an edit (PATCH, where `nextActions` are new ones only). */
export const useSaveMinutes = (id: string, published: boolean) =>
  useMeetingMutation((input: MinutesInput) =>
    published
      ? api.patch<MeetingDetail>(`/meetings/${id}/minutes`, input)
      : api.post<MeetingDetail>(`/meetings/${id}/minutes`, input),
  );

export const useSetMinutesFile = (id: string) =>
  useMeetingMutation((file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.put<MeetingDetail>(`/meetings/${id}/minutes/file`, form);
  });

// ── Attendance (US-7) ──
export const useOpenAttendance = (id: string, open: boolean) =>
  useMeetingMutation(() =>
    api.post<MeetingDetail>(`/meetings/${id}/attendance/${open ? 'open' : 'close'}`),
  );

export const useMarkAttendance = (id: string) =>
  useMeetingMutation(
    ({
      membershipId,
      ...body
    }: {
      membershipId: string;
      status: AttendanceStatus;
      note?: string;
    }) => api.put<MeetingDetail>(`/meetings/${id}/attendance/${membershipId}`, body),
  );

/**
 * The QR token lives 60 s; fetching a new one every 30 s means a code being scanned is always valid for at
 * least another 30 s.
 */
export const useQrToken = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ['meetings', id, 'qr'],
    queryFn: async () =>
      (await api.get<{ token: string; expiresAt: string }>(`/meetings/${id}/attendance/token`))
        .data,
    enabled,
    refetchInterval: 30_000,
  });

export const useCheckIn = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api.post(`/meetings/${id}/check-in`, { token }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meetings'] }),
  });
};

export function checkInErrorMessage(error: unknown): string {
  return errorMessage(error, {
    400: 'QR sudah kedaluwarsa atau presensi ditutup. Pindai QR terbaru di layar penyelenggara.',
    403: 'Kamu tidak diundang ke rapat ini.',
    404: 'Rapat tidak ditemukan.',
    409: 'Kehadiranmu sudah tercatat.',
  });
}

export function meetingErrorMessage(error: unknown, conflict = ''): string {
  return errorMessage(error, {
    400: 'Data tidak valid. Rapat < 24 jam lagi perlu ditandai mendesak dengan alasan, dan PIC tindak lanjut harus diundang.',
    403: 'Kamu tidak berwenang mengatur rapat ini.',
    404: 'Rapat atau unit tidak ditemukan. Muat ulang halaman.',
    409: conflict || 'Rapat sudah dimulai, dibatalkan, atau sudah selesai.',
    413: 'Ukuran file maksimal 10 MB.',
  });
}

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UnitFilterValues } from '@/features/search/unit-filters';
import { api, errorMessage } from '@/lib/api';
import { evidenceForm, type Evidence } from '@/features/evidence/evidence';
import type { DepartmentKind, Paginated } from '@/features/org/org-api';
import type { Position } from '@/features/org/positions';

// Shapes mirror the API responses (apps/api/src/proker); only the fields the screens read are listed.
export const PROKER_TYPES = [
  'PROYEK_BESAR',
  'PROYEK_MENENGAH',
  'AGENDA_BESAR',
  'AGENDA_MENENGAH',
  'PRODUK_PUBLIKASI',
  'PRODUK_NON_PUBLIKASI',
] as const;
export type ProkerType = (typeof PROKER_TYPES)[number];

export const PROKER_STATUSES = ['PLANNED', 'ONGOING', 'DONE', 'CANCELLED'] as const;
export type ProkerStatus = (typeof PROKER_STATUSES)[number];

export type CommitteeRole = 'KETUA_PELAKSANA' | 'SEKBEN' | 'KADIV' | 'ANGGOTA';

interface UnitRef {
  id: string;
  name: string;
  code: string;
}

export interface Person {
  id: string;
  position: Position;
  user: { id: string; name: string };
}

/** The public summary (US-3.8): what the list shows to everyone, guests included. */
export interface ProkerSummary {
  id: string;
  name: string;
  type: ProkerType;
  status: ProkerStatus;
  eventDate: string | null;
  department: UnitRef & { kind: DepartmentKind; kesekjenanId: string };
  biro: UnitRef | null;
}

export interface ChecklistItem extends Evidence {
  id: string;
  key: string;
  label: string;
  dueDate: string | null;
  doneAt: string | null;
  note: string | null;
  overdue: boolean;
}

export interface Progress {
  done: number;
  total: number;
  overdue: number;
  next: { key: string; label: string; dueDate: string | null } | null;
}

export interface ProkerDetail extends ProkerSummary {
  description: string;
  estimatedBudget: number;
  cancelReason: string | null;
  picMembershipId: string | null;
  pic: Person | null;
  needsPic: boolean;
  committee: { role: CommitteeRole; divisionName: string | null; membership: Person }[];
  checklist: ChecklistItem[];
  progress: Progress;
  evaluation: Evaluation | null;
}

/** US-3.10: the post-event evaluation (apps/api/src/proker/dto/proker.dto.ts → EvaluationDto). */
export interface EvaluationInput {
  wentWell: string;
  toImprove: string;
  problems: string;
  recommendations: string;
  feedbackUrl?: string;
}

export interface Evaluation extends Omit<EvaluationInput, 'feedbackUrl'> {
  feedbackUrl: string | null;
  updatedAt: string;
  filledBy: { id: string; name: string };
  updatedBy: { id: string; name: string };
}

/** A row in the department, kesekjenan and biro overviews. */
export type ProkerProgress = ProkerSummary & { progress: Progress };

export type DepartmentMember = Person & { biro: { id: string; name: string } | null };

export interface ProkerQuery extends UnitFilterValues {
  q?: string;
  type?: ProkerType;
  status?: ProkerStatus;
  page: number;
}

export interface ProkerInput {
  name: string;
  description?: string;
  type: ProkerType;
  eventDate?: string;
  estimatedBudget?: number;
}

export interface SeatInput {
  membershipId: string;
  role: Exclude<CommitteeRole, 'KETUA_PELAKSANA'>;
  divisionName?: string;
}

// ── Queries ──
export const useProkers = (query: ProkerQuery) =>
  useQuery({
    queryKey: ['prokers', query],
    queryFn: async () =>
      (
        await api.get<Paginated<ProkerSummary>>('/prokers', {
          params: { ...query, limit: 20, sort: 'eventDate:asc' },
        })
      ).data,
    placeholderData: keepPreviousData,
  });

export const useProker = (id: string | undefined) =>
  useQuery({
    queryKey: ['proker', id],
    queryFn: async () => (await api.get<ProkerDetail>(`/prokers/${id}`)).data,
    enabled: !!id,
  });

export const useProkerMembers = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: ['proker-members', id],
    queryFn: async () => (await api.get<DepartmentMember[]>(`/prokers/${id}/members`)).data,
    enabled,
  });

// ── Mutations ──
/**
 * A proker write changes its detail, the lists and every overview that shows its progress, so each
 * mutation refetches all of them instead of patching caches by hand (same approach as org-api.ts).
 */
function useProkerMutation<TInput, TResult = unknown>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all(
        ['prokers', 'proker', 'department-overview', 'kesekjenan-overview', 'biro-overview'].map(
          (key) => queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      ),
  });
}

export const useCreateProker = () =>
  useProkerMutation(
    async ({
      departmentId,
      ...input
    }: ProkerInput & { departmentId: string; biroId?: string; picMembershipId?: string }) =>
      (await api.post<ProkerDetail>(`/departments/${departmentId}/prokers`, input)).data,
  );

export const useUpdateProker = (id: string) =>
  useProkerMutation((input: Partial<ProkerInput>) => api.patch(`/prokers/${id}`, input));

export const useAssignProker = (id: string) =>
  useProkerMutation((input: { biroId: string | null; picMembershipId: string | null }) =>
    api.patch(`/prokers/${id}/assignment`, input),
  );

export const useChangeStatus = (id: string) =>
  useProkerMutation((input: { status: ProkerStatus; reason?: string }) =>
    api.post(`/prokers/${id}/status`, input),
  );

export const useSaveEvaluation = (id: string) =>
  useProkerMutation((input: EvaluationInput) => api.put(`/prokers/${id}/evaluation`, input));

export const useTickItem = (id: string) =>
  useProkerMutation((key: string) => api.post(`/prokers/${id}/checklist/${key}/tick`, {}));

export interface ChecklistEdit {
  label?: string;
  dueDate?: string;
  /** An empty string clears it. */
  note?: string;
  evidenceUrl?: string;
}

export const useUntickItem = (id: string) =>
  useProkerMutation((key: string) => api.delete(`/prokers/${id}/checklist/${key}/tick`));

export const useEditItem = (id: string) =>
  useProkerMutation(({ key, ...input }: ChecklistEdit & { key: string }) =>
    api.patch(`/prokers/${id}/checklist/${key}`, input),
  );

export const useSetItemEvidence = (id: string) =>
  useProkerMutation(({ key, ...input }: { key: string; evidenceUrl?: string; file?: File }) =>
    api.put(`/prokers/${id}/checklist/${key}/evidence`, evidenceForm(input)),
  );

export const useSetCommittee = (id: string) =>
  useProkerMutation((members: SeatInput[]) => api.put(`/prokers/${id}/committee`, { members }));

export const useDeleteProker = (id: string) =>
  useProkerMutation(() => api.delete(`/prokers/${id}`));

/** Indonesian message for a proker write; `conflict` explains the 409 of that particular action. */
export function prokerErrorMessage(error: unknown, conflict = ''): string {
  return errorMessage(error, {
    400: 'Data tidak valid. Periksa kembali isian.',
    403: 'Kamu tidak berwenang melakukan ini.',
    404: 'Proker sudah tidak ada. Muat ulang halaman.',
    413: 'Ukuran file maksimal 10 MB.',
    409: conflict,
  });
}

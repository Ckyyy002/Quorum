import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import type { Paginated } from '@/features/org/org-api';
import { evidenceForm, type Evidence } from '@/features/evidence/evidence';
import type { Person } from '@/features/proker/proker-api';

// Shapes mirror the API responses (apps/api/src/task); only the fields the screens read are listed.
export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'Belum mulai',
  IN_PROGRESS: 'Dikerjakan',
  DONE: 'Selesai',
};

export interface Task extends Evidence {
  id: string;
  title: string;
  description: string;
  deadline: string | null;
  status: TaskStatus;
  completedAt: string | null;
  source: 'PROKER' | 'MEETING';
  assignee: Person | null;
  proker: { id: string; name: string } | null;
  isOverdue: boolean;
}

export interface TaskInput {
  title: string;
  description: string;
  deadline: string;
  assigneeMembershipId: string;
}

/**
 * UI hint mirroring apps/api/src/task/domain/task-rules.ts, so the board only offers legal moves.
 * The API still answers 400 for a skip.
 */
const NEXT: Record<TaskStatus, TaskStatus[]> = {
  TODO: ['IN_PROGRESS'],
  IN_PROGRESS: ['DONE'],
  DONE: ['IN_PROGRESS'],
};
export const canMoveTask = (from: TaskStatus, to: TaskStatus) => NEXT[from].includes(to);

// ── Queries ──
// shortcut: the board shows the first 50 tasks (the API's page limit); add paging if a proker grows past it.
export const useProkerTasks = (prokerId: string, assigneeMembershipId: string) =>
  useQuery({
    queryKey: ['tasks', prokerId, assigneeMembershipId],
    queryFn: async () =>
      (
        await api.get<Paginated<Task>>(`/prokers/${prokerId}/tasks`, {
          params: { limit: 50, ...(assigneeMembershipId && { assigneeMembershipId }) },
        })
      ).data,
    placeholderData: keepPreviousData,
  });

/**
 * How many of my tasks are in each status, for the Tugasku tabs. `limit=1` asks only for `meta.total`,
 * so this reuses GET /me/tasks instead of adding a count endpoint.
 */
export function useMyTaskCounts(): Partial<Record<TaskStatus | 'ALL', number>> {
  const keys = ['ALL', ...TASK_STATUSES] as const;
  const results = useQueries({
    queries: keys.map((key) => ({
      queryKey: ['my-tasks', 'count', key],
      queryFn: async () =>
        (
          await api.get<Paginated<Task>>('/me/tasks', {
            params: { limit: 1, ...(key !== 'ALL' && { status: key }) },
          })
        ).data.meta.total,
    })),
  });
  return Object.fromEntries(keys.map((key, i) => [key, results[i]?.data]));
}

export const useMyTasks = (query: { status?: TaskStatus; page: number }) =>
  useQuery({
    queryKey: ['my-tasks', query],
    queryFn: async () =>
      (await api.get<Paginated<Task>>('/me/tasks', { params: { ...query, limit: 20 } })).data,
    placeholderData: keepPreviousData,
  });

// ── Mutations ──
/** Every task write can change the board and "my tasks", so both are refetched. */
function useTaskMutation<TInput>(fn: (input: TInput) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all(
        ['tasks', 'my-tasks'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      ),
  });
}

export const useCreateTask = (prokerId: string) =>
  useTaskMutation((input: TaskInput) => api.post(`/prokers/${prokerId}/tasks`, input));

export const useUpdateTask = () =>
  useTaskMutation(({ id, ...input }: Partial<TaskInput> & { id: string }) =>
    api.patch(`/tasks/${id}`, input),
  );

export const useDeleteTask = () => useTaskMutation((id: string) => api.delete(`/tasks/${id}`));

export const useSetTaskEvidence = () =>
  useTaskMutation(({ id, ...input }: { id: string; evidenceUrl?: string; file?: File }) =>
    api.put(`/tasks/${id}/evidence`, evidenceForm(input)),
  );

export const useMoveTask = () =>
  useTaskMutation(({ id, status }: { id: string; status: TaskStatus }) =>
    api.post(`/tasks/${id}/status`, { status }),
  );

export function taskErrorMessage(error: unknown): string {
  return errorMessage(error, {
    400: 'Data tidak valid: tenggat tidak boleh lewat, penanggung jawab harus anggota departemen, dan status harus berurutan.',
    403: 'Kamu tidak berwenang melakukan ini.',
    404: 'Tugas sudah tidak ada. Muat ulang halaman.',
    413: 'Ukuran file maksimal 10 MB.',
  });
}

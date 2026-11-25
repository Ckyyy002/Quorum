import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { Position } from './positions';

// Shapes mirror the API responses (apps/api/src/org); only the fields the screens read are listed.
export interface Period {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export type KesekjenanCode = 'PENGEMBANGAN' | 'RELASI' | 'PERSONALIA';
export type DepartmentKind = 'DEPARTMENT' | 'SPECIAL_BIRO';

export interface Biro {
  id: string;
  name: string;
  code: string;
  departmentId: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  kind: DepartmentKind;
  kesekjenanId: string;
  biros: Biro[];
}

export interface Kesekjenan {
  id: string;
  code: KesekjenanCode;
  name: string;
  departments: Department[];
}

export interface Structure extends Period {
  kesekjenan: Kesekjenan[];
}

export interface MemberUser {
  id: string;
  name: string;
  email: string;
  nrp: string | null;
}

export interface Membership {
  id: string;
  periodId: string;
  position: Position;
  endedAt: string | null;
  user: MemberUser;
  department: { id: string; name: string; code: string; kind: DepartmentKind } | null;
  biro: { id: string; name: string; code: string } | null;
  coversKesekjenan: { id: string; code: KesekjenanCode; name: string } | null;
}

/** Overview rows only carry the member, not the units (they are implied by where the row sits). */
export type OverviewMember = Pick<Membership, 'id' | 'position' | 'user'>;

export interface DepartmentOverview {
  id: string;
  name: string;
  code: string;
  kind: DepartmentKind;
  kesekjenan: { id: string; code: KesekjenanCode; name: string };
  /** Members placed on the department itself (Kadep, Sekdep, Asisten Biro). */
  memberships: OverviewMember[];
  biros: (Biro & { memberships: OverviewMember[] })[];
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface Placement {
  position: Position;
  departmentId?: string;
  biroId?: string;
  coversKesekjenanId?: string;
}

export interface MembershipQuery {
  periodId?: string;
  departmentId?: string;
  position?: Position;
  q?: string;
  page: number;
}

// ── Queries ──
export const usePeriods = () =>
  useQuery({
    queryKey: ['periods'],
    queryFn: async () => (await api.get<Period[]>('/periods')).data,
  });

export const useStructure = (periodId: string | undefined) =>
  useQuery({
    queryKey: ['structure', periodId],
    queryFn: async () => (await api.get<Structure>(`/periods/${periodId}/structure`)).data,
    enabled: !!periodId,
  });

export const useDepartmentOverview = (id: string | undefined) =>
  useQuery({
    queryKey: ['department-overview', id],
    queryFn: async () => (await api.get<DepartmentOverview>(`/departments/${id}/overview`)).data,
    enabled: !!id,
  });

export const useMemberships = (query: MembershipQuery) =>
  useQuery({
    queryKey: ['memberships', query],
    queryFn: async () =>
      (await api.get<Paginated<Membership>>('/memberships', { params: { ...query, limit: 20 } }))
        .data,
    enabled: !!query.periodId,
    // Keep the old page on screen while the next one loads, so the table does not flash empty.
    placeholderData: keepPreviousData,
  });

export const useUserSearch = (q: string) =>
  useQuery({
    queryKey: ['users', q],
    queryFn: async () =>
      (await api.get<Paginated<MemberUser>>('/users', { params: { q, limit: 8 } })).data,
    enabled: q.trim().length >= 2,
  });

// ── Mutations ──
/**
 * Any write to the organization can change the tree, overviews and member lists at once, so every
 * mutation simply refetches all org queries instead of patching caches by hand.
 */
function useOrgMutation<TInput, TResult = unknown>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all(
        ['periods', 'structure', 'department-overview', 'memberships'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      ),
  });
}

export interface PeriodInput {
  name: string;
  startDate: string;
  endDate: string;
}

export interface UnitInput {
  name: string;
  code: string;
}

export const useCreatePeriod = () =>
  useOrgMutation(async (input: PeriodInput) => (await api.post<Period>('/periods', input)).data);

export const useActivatePeriod = () =>
  useOrgMutation((id: string) => api.post(`/periods/${id}/activate`));

export const useCreateDepartment = () =>
  useOrgMutation(
    async (input: UnitInput & { kesekjenanId: string; kind: DepartmentKind }) =>
      (await api.post<Department>('/departments', input)).data,
  );

export const useUpdateDepartment = () =>
  useOrgMutation(({ id, ...input }: UnitInput & { id: string }) =>
    api.patch(`/departments/${id}`, input),
  );

export const useDeleteDepartment = () =>
  useOrgMutation((id: string) => api.delete(`/departments/${id}`));

export const useCreateBiro = () =>
  useOrgMutation(({ departmentId, ...input }: UnitInput & { departmentId: string }) =>
    api.post(`/departments/${departmentId}/biros`, input),
  );

export const useUpdateBiro = () =>
  useOrgMutation(({ id, ...input }: UnitInput & { id: string }) =>
    api.patch(`/biros/${id}`, input),
  );

export const useDeleteBiro = () => useOrgMutation((id: string) => api.delete(`/biros/${id}`));

export const useCreateMembership = () =>
  useOrgMutation((input: Placement & { userId: string; periodId: string }) =>
    api.post('/memberships', input),
  );

export const useUpdateMembership = () =>
  useOrgMutation(({ id, ...placement }: Placement & { id: string }) =>
    api.patch(`/memberships/${id}`, placement),
  );

export const useEndMembership = () =>
  useOrgMutation((id: string) => api.post(`/memberships/${id}/end`));

// ── Helpers shared by the admin screens ──
/** Indonesian message for an org write; 409 is the common one (duplicate code, unit still in use). */
export function orgErrorMessage(error: unknown, conflict: string): string {
  return errorMessage(error, {
    400: 'Data tidak valid. Periksa kembali isian.',
    403: 'Hanya Admin Sistem yang boleh mengubah struktur.',
    404: 'Data sudah tidak ada. Muat ulang halaman.',
    409: conflict,
  });
}

/** The period an admin screen works on: the one picked, else the active one, else the newest. */
export function usePeriodChoice() {
  const periods = usePeriods();
  const [chosen, setChosen] = useState<string>();
  const periodId = chosen ?? (periods.data?.find((p) => p.isActive) ?? periods.data?.[0])?.id;
  return { periods, periodId, setPeriodId: setChosen };
}

export type PeriodChoice = ReturnType<typeof usePeriodChoice>;

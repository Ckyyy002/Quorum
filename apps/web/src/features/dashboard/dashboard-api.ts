import { useQuery } from '@tanstack/react-query';
import type { DocumentStatus, DocumentType } from '@/features/document/document-api';
import type { MeetingType } from '@/features/meeting/meeting-api';
import type { ProkerProgress } from '@/features/proker/proker-api';
import type { TaskStatus } from '@/features/task/task-api';
import { api } from '@/lib/api';

// Shapes mirror apps/api/src/dashboard; only the fields the home page reads are listed.
export type NextStep = 'SUBMIT' | 'REVIEW' | 'PENGESAHAN' | 'TO_KAPRODI' | 'SIGN' | 'ARCHIVE';

export const NEXT_STEP_LABEL: Record<NextStep, string> = {
  SUBMIT: 'Ajukan ke Sekjen',
  REVIEW: 'Review',
  PENGESAHAN: 'Pengesahan',
  TO_KAPRODI: 'Kirim ke Kaprodi',
  SIGN: 'Unggah PDF bertanda tangan',
  ARCHIVE: 'Arsipkan',
};

export interface MyDashboard {
  documents: {
    id: string;
    type: DocumentType;
    title: string;
    status: DocumentStatus;
    proker: { id: string; name: string };
    step: NextStep;
  }[];
  tasks: {
    open: number;
    overdue: number;
    next: {
      id: string;
      title: string;
      deadline: string | null;
      status: TaskStatus;
      proker: { id: string; name: string } | null;
    }[];
  };
  meetings: { id: string; type: MeetingType; title: string; startsAt: string; location: string }[];
}

export interface Rate {
  invited: number;
  present: number;
  excused: number;
  percent: number | null;
}

export interface ProkerSummary {
  total: number;
  byStatus: Record<string, number>;
  checklistDone: number;
  checklistTotal: number;
}

export interface OrganizationDashboard {
  monthStart: string;
  kesekjenan: {
    id: string;
    name: string;
    departments: {
      id: string;
      name: string;
      prokers: ProkerSummary;
      lateDocuments: number;
      attendance: Rate | null;
    }[];
  }[];
}

interface LateDocument {
  id: string;
  type: DocumentType;
  title: string;
  status: DocumentStatus;
  proker: { id: string; name: string };
}

export interface DepartmentDashboard {
  id: string;
  name: string;
  monthStart: string;
  biros: { id: string | null; name: string; summary: ProkerSummary; prokers: ProkerProgress[] }[];
  overdueTasks: {
    id: string;
    title: string;
    deadline: string;
    assignee: { id: string; user: { name: string } } | null;
    proker: { id: string; name: string } | null;
  }[];
  lateDocuments: LateDocument[];
  members: {
    id: string;
    position: string;
    user: { id: string; name: string };
    overdueTasks: number;
    attendance: Rate | null;
  }[];
}

export interface BudgetTotals {
  proposal: Record<string, number>;
  lpj: Record<string, number>;
  proposalTotal: number;
  lpjTotal: number;
}

export interface BudgetDashboard {
  total: BudgetTotals;
  kesekjenan: {
    id: string;
    name: string;
    totals: BudgetTotals;
    departments: { id: string; name: string; totals: BudgetTotals }[];
  }[];
}

const get = async <T>(path: string) => (await api.get<T>(`/dashboard/${path}`)).data;

export const useMyDashboard = () =>
  useQuery({ queryKey: ['dashboard', 'me'], queryFn: () => get<MyDashboard>('me') });

// The home page mounts each section only for the groups the API rule allows, so none of these fetch a 403.
export const useOrganizationDashboard = () =>
  useQuery({
    queryKey: ['dashboard', 'organization'],
    queryFn: () => get<OrganizationDashboard>('organization'),
  });

export const useDepartmentDashboard = (id: string) =>
  useQuery({
    queryKey: ['dashboard', 'department', id],
    queryFn: () => get<DepartmentDashboard>(`department/${id}`),
  });

export const useBudgetDashboard = () =>
  useQuery({ queryKey: ['dashboard', 'budget'], queryFn: () => get<BudgetDashboard>('budget') });

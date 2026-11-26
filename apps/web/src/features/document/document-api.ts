import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';

// Shapes mirror the API responses (apps/api/src/document); only the fields the screens read are listed.
export const DOCUMENT_TYPES = ['PROPOSAL', 'LPJ'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export type DocumentStatus =
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'REVIEWED'
  | 'APPROVED'
  | 'AT_KAPRODI'
  | 'SIGNED'
  | 'ARCHIVED'
  | 'REVISION';

export const FUNDING_SOURCES = ['PAGU_DEPARTEMEN', 'KAS_HMTC', 'MANDIRI'] as const;
export type FundingSource = (typeof FUNDING_SOURCES)[number];

export const TYPE_LABEL: Record<DocumentType, string> = { PROPOSAL: 'Proposal', LPJ: 'LPJ' };

export const STATUS_LABEL: Record<DocumentStatus, string> = {
  DRAFT: 'Draf',
  IN_REVIEW: 'Direview Sekjen',
  REVIEWED: 'Menunggu pengesahan',
  APPROVED: 'Disahkan',
  AT_KAPRODI: 'Di Kaprodi',
  SIGNED: 'Ditandatangani',
  ARCHIVED: 'Diarsipkan',
  REVISION: 'Perlu revisi',
};

export const FUNDING_LABEL: Record<FundingSource, string> = {
  PAGU_DEPARTEMEN: 'Pagu departemen',
  KAS_HMTC: 'Kas HMTC',
  MANDIRI: 'Mandiri',
};

export const STEP_LABEL: Record<string, string> = {
  KAPRODI_DISCUSSION: 'Diskusi dengan Kaprodi (H-21)',
  SUBMIT: 'Diajukan ke Sekjen (H-18)',
  PENGESAHAN: 'Disahkan Ketua (H-15)',
  TO_KAPRODI: 'Dikirim ke Kaprodi (H-14)',
};

export const ACTION_LABEL: Record<string, string> = {
  SUBMIT: 'Diajukan untuk review',
  APPROVE_ADMIN: 'Administrasi disetujui',
  APPROVE_FINANCE: 'Keuangan disetujui',
  RETURN_REVIEW: 'Dikembalikan oleh Sekjen',
  APPROVE: 'Disahkan Ketua',
  RETURN_PENGESAHAN: 'Dikembalikan oleh Ketua',
  KAPRODI_DISCUSSION: 'Diskusi Kaprodi dilakukan',
  TO_KAPRODI: 'Dikirim ke Kaprodi',
  SIGN: 'PDF bertanda tangan diunggah',
  ARCHIVE: 'Diarsipkan',
};

interface PersonRef {
  id: string;
  name: string;
}

export interface DocumentSummary {
  id: string;
  prokerId: string;
  type: DocumentType;
  title: string;
  status: DocumentStatus;
  version: number;
  totalBudget: number;
  fundingSource: FundingSource | null;
  updatedAt: string;
  author: PersonRef;
}

export interface DocumentDetail extends DocumentSummary {
  proker: { id: string; name: string; eventDate: string | null; departmentId: string };
  adminApprovedBy: PersonRef | null;
  financeApprovedBy: PersonRef | null;
  attachments: {
    id: string;
    originalName: string;
    version: number | null;
    kind: 'DRAFT' | 'SIGNED';
    createdAt: string;
    uploadedBy: PersonRef;
  }[];
  approvalLogs: {
    id: string;
    fromStatus: DocumentStatus;
    toStatus: DocumentStatus;
    action: string;
    note: string | null;
    actorPosition: string | null;
    createdAt: string;
    actor: PersonRef;
  }[];
  deadlines: {
    step: string;
    dueDate: string;
    doneAt: string | null;
    state: 'DONE' | 'LATE' | 'PENDING';
  }[];
  budgetComparison: {
    approved: number;
    realized: number;
    rupiah: number;
    percent: number | null;
  } | null;
}

export interface DocumentInput {
  type?: DocumentType;
  title?: string;
  totalBudget?: number;
  fundingSource?: FundingSource;
  file?: File;
}

// Same limits as apps/api/src/upload/domain/upload-rules.ts (DOCUMENT_FILES); the API checks the content again.
export const DOCUMENT_ACCEPT = '.pdf,.docx';

/** Multipart body: the API reads every field as text and converts the budget itself. */
function documentForm(input: DocumentInput): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    form.append(key, value instanceof File ? value : String(value));
  }
  return form;
}

// ── Queries ──
export const useProkerDocuments = (prokerId: string) =>
  useQuery({
    queryKey: ['documents', 'proker', prokerId],
    queryFn: async () => (await api.get<DocumentSummary[]>(`/prokers/${prokerId}/documents`)).data,
  });

export const useDocument = (id: string) =>
  useQuery({
    queryKey: ['documents', id],
    queryFn: async () => (await api.get<DocumentDetail>(`/documents/${id}`)).data,
  });

// ── Mutations ──
/** Every document write can change the proker's document cards and the detail page. */
function useDocumentMutation<TInput>(fn: (input: TInput) => Promise<{ data: DocumentDetail }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TInput) => (await fn(input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['documents'] }),
  });
}

export const useCreateDocument = (prokerId: string) =>
  useDocumentMutation((input: DocumentInput) =>
    api.post<DocumentDetail>(`/prokers/${prokerId}/documents`, documentForm(input)),
  );

export const useUpdateDocument = (id: string) =>
  useDocumentMutation((input: DocumentInput) =>
    api.patch<DocumentDetail>(`/documents/${id}`, documentForm(input)),
  );

/** One workflow step: submit, review, pengesahan, kaprodi-discussion, to-kaprodi, archive. */
export const useDocumentStep = (id: string) =>
  useDocumentMutation(
    ({ step, body }: { step: string; body?: { decision: string; note?: string } }) =>
      api.post<DocumentDetail>(`/documents/${id}/${step}`, body),
  );

export const useUploadSigned = (id: string) =>
  useDocumentMutation((file: File) =>
    api.post<DocumentDetail>(`/documents/${id}/signed`, documentForm({ file })),
  );

export function documentErrorMessage(error: unknown, conflict = ''): string {
  return errorMessage(error, {
    400: 'Data tidak valid. File harus PDF atau DOCX (PDF untuk yang bertanda tangan), dan proposal perlu anggaran serta sumber dana.',
    403: 'Kamu tidak berwenang melakukan ini.',
    404: 'Dokumen sudah tidak ada. Muat ulang halaman.',
    409: conflict || 'Status dokumen sudah berubah. Muat ulang halaman lalu coba lagi.',
    413: 'Ukuran file maksimal 10 MB.',
  });
}

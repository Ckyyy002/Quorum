import { dayHasPassed } from '../../common/wib';

// Mirror the Prisma enums so domain code (and DTO validation) stays free of Prisma imports.
export const DOCUMENT_TYPES = ['PROPOSAL', 'LPJ'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'REVIEWED',
  'APPROVED',
  'AT_KAPRODI',
  'SIGNED',
  'ARCHIVED',
  'REVISION',
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const FUNDING_SOURCES = ['PAGU_DEPARTEMEN', 'KAS_HMTC', 'MANDIRI'] as const;
export type FundingSource = (typeof FUNDING_SOURCES)[number];

/** Every step of the Buku Biru flow (product.md → Document workflow). */
export type DocumentAction =
  | 'SUBMIT'
  | 'APPROVE_ADMIN'
  | 'APPROVE_FINANCE'
  | 'RETURN_REVIEW'
  | 'APPROVE'
  | 'RETURN_PENGESAHAN'
  | 'TO_KAPRODI'
  | 'SIGN'
  | 'ARCHIVE';

export interface WorkflowState {
  status: DocumentStatus;
  adminApproved: boolean;
  financeApproved: boolean;
}

export type TransitionResult = { ok: true; next: WorkflowState } | { ok: false; error: string };

/** The status each action starts from. One table, so an illegal move is rejected in one place. */
const FROM: Record<DocumentAction, readonly DocumentStatus[]> = {
  // US-5.7: a returned document is edited in REVISION and submitted again directly.
  SUBMIT: ['DRAFT', 'REVISION'],
  APPROVE_ADMIN: ['IN_REVIEW'],
  APPROVE_FINANCE: ['IN_REVIEW'],
  RETURN_REVIEW: ['IN_REVIEW'],
  APPROVE: ['REVIEWED'],
  RETURN_PENGESAHAN: ['REVIEWED'],
  TO_KAPRODI: ['APPROVED'],
  SIGN: ['AT_KAPRODI'],
  ARCHIVE: ['SIGNED'],
};

const NOT_REVIEWED = { adminApproved: false, financeApproved: false };

/**
 * Applies one action. A wrong starting status or a repeated approval is a conflict with the document's
 * current state (409); who may fire the action is the policy's job, not this function's.
 */
export function transition(state: WorkflowState, action: DocumentAction): TransitionResult {
  if (!FROM[action].includes(state.status)) {
    return { ok: false, error: `Cannot ${action.toLowerCase()} a document in ${state.status}` };
  }
  switch (action) {
    case 'SUBMIT':
      // US-5.7 AC2: every (re-)submission needs both reviews again.
      return { ok: true, next: { status: 'IN_REVIEW', ...NOT_REVIEWED } };
    case 'APPROVE_ADMIN':
    case 'APPROVE_FINANCE':
      return approve(state, action === 'APPROVE_ADMIN' ? 'adminApproved' : 'financeApproved');
    case 'RETURN_REVIEW':
    case 'RETURN_PENGESAHAN':
      return { ok: true, next: { status: 'REVISION', ...NOT_REVIEWED } };
    case 'APPROVE':
      return { ok: true, next: { ...state, status: 'APPROVED' } };
    case 'TO_KAPRODI':
      return { ok: true, next: { ...state, status: 'AT_KAPRODI' } };
    case 'SIGN':
      return { ok: true, next: { ...state, status: 'SIGNED' } };
    case 'ARCHIVE':
      return { ok: true, next: { ...state, status: 'ARCHIVED' } };
  }
}

/** US-5.3 AC3: the two reviews run in parallel; the second approval moves the document to REVIEWED. */
function approve(
  state: WorkflowState,
  part: 'adminApproved' | 'financeApproved',
): TransitionResult {
  if (state[part]) return { ok: false, error: 'This part is already approved' };
  const next = { ...state, [part]: true };
  if (next.adminApproved && next.financeApproved) next.status = 'REVIEWED';
  return { ok: true, next };
}

/** US-5.1, 5.7: fields and files change only while the drafters hold the document. */
export function isEditable(status: DocumentStatus): boolean {
  return status === 'DRAFT' || status === 'REVISION';
}

/** US-5.2 AC1: what must be filled in before review; null when the document can be submitted. */
export function submitProblem(doc: {
  type: DocumentType;
  hasFile: boolean;
  totalBudget: number;
  fundingSource: FundingSource | null;
}): string | null {
  if (!doc.hasFile) return 'Upload the document file before submitting';
  if (doc.type === 'PROPOSAL' && (doc.totalBudget <= 0 || !doc.fundingSource)) {
    return 'A proposal needs a total budget above 0 and a funding source before submitting';
  }
  return null;
}

/** US-5.2 AC4: an LPJ reports on a finished event, so it is submitted only after the event day ends. */
export function lpjTooEarly(eventDate: Date | null, now: Date): boolean {
  return !eventDate || !dayHasPassed(eventDate, now);
}

/** US-5.4 AC2: realized (LPJ) against approved (proposal) budget. Percent is null without a proposal budget. */
export function budgetDifference(approved: number, realized: number) {
  const rupiah = realized - approved;
  return {
    approved,
    realized,
    rupiah,
    percent: approved > 0 ? Math.round((rupiah / approved) * 1000) / 10 : null,
  };
}

import { wibDay } from '../../common/wib';
import {
  budgetDifference,
  isEditable,
  lpjTooEarly,
  submitProblem,
  transition,
  type DocumentStatus,
  type WorkflowState,
} from './document-workflow';

const state = (status: DocumentStatus, over: Partial<WorkflowState> = {}): WorkflowState => ({
  status,
  adminApproved: false,
  financeApproved: false,
  ...over,
});

describe('transition', () => {
  it('walks the whole flow from DRAFT to ARCHIVED', () => {
    // Arrange
    const steps = [
      'SUBMIT',
      'APPROVE_ADMIN',
      'APPROVE_FINANCE',
      'APPROVE',
      'TO_KAPRODI',
      'SIGN',
      'ARCHIVE',
    ] as const;
    let current = state('DRAFT');
    const seen: DocumentStatus[] = [];

    // Act
    for (const action of steps) {
      const result = transition(current, action);
      if (!result.ok) throw new Error(result.error);
      current = result.next;
      seen.push(current.status);
    }

    // Assert
    expect(seen).toEqual([
      'IN_REVIEW',
      'IN_REVIEW',
      'REVIEWED',
      'APPROVED',
      'AT_KAPRODI',
      'SIGNED',
      'ARCHIVED',
    ]);
  });

  it('moves to REVIEWED only when both reviews approved, in either order', () => {
    const afterFinance = transition(state('IN_REVIEW'), 'APPROVE_FINANCE');
    expect(afterFinance).toEqual({
      ok: true,
      next: { status: 'IN_REVIEW', adminApproved: false, financeApproved: true },
    });

    const afterBoth = transition(state('IN_REVIEW', { financeApproved: true }), 'APPROVE_ADMIN');
    expect(afterBoth).toEqual({
      ok: true,
      next: { status: 'REVIEWED', adminApproved: true, financeApproved: true },
    });
  });

  it('rejects approving the same part twice', () => {
    expect(transition(state('IN_REVIEW', { adminApproved: true }), 'APPROVE_ADMIN')).toEqual({
      ok: false,
      error: 'This part is already approved',
    });
  });

  it('clears both approvals when a reviewer or the Ketua returns the document', () => {
    const fromReview = transition(state('IN_REVIEW', { adminApproved: true }), 'RETURN_REVIEW');
    const fromKetua = transition(
      state('REVIEWED', { adminApproved: true, financeApproved: true }),
      'RETURN_PENGESAHAN',
    );
    const revision = { status: 'REVISION', adminApproved: false, financeApproved: false };

    expect(fromReview).toEqual({ ok: true, next: revision });
    expect(fromKetua).toEqual({ ok: true, next: revision });
  });

  it('lets a returned document be submitted again with fresh reviews', () => {
    expect(transition(state('REVISION'), 'SUBMIT')).toEqual({
      ok: true,
      next: { status: 'IN_REVIEW', adminApproved: false, financeApproved: false },
    });
  });

  it.each([
    ['DRAFT', 'APPROVE'],
    ['IN_REVIEW', 'APPROVE'],
    ['IN_REVIEW', 'RETURN_PENGESAHAN'],
    ['REVIEWED', 'RETURN_REVIEW'],
    ['APPROVED', 'SIGN'],
    ['ARCHIVED', 'SUBMIT'],
    ['IN_REVIEW', 'SUBMIT'],
  ] as const)('rejects %s → %s', (status, action) => {
    expect(transition(state(status), action).ok).toBe(false);
  });
});

describe('isEditable', () => {
  it('allows edits only in DRAFT and REVISION', () => {
    expect(isEditable('DRAFT')).toBe(true);
    expect(isEditable('REVISION')).toBe(true);
    expect(isEditable('IN_REVIEW')).toBe(false);
    expect(isEditable('ARCHIVED')).toBe(false);
  });
});

describe('submitProblem', () => {
  const proposal = {
    type: 'PROPOSAL' as const,
    hasFile: true,
    totalBudget: 1_500_000,
    fundingSource: 'KAS_HMTC' as const,
    hasRab: true,
  };

  it('accepts a complete proposal and an LPJ without budget', () => {
    expect(submitProblem(proposal)).toBeNull();
    expect(
      submitProblem({
        type: 'LPJ',
        hasFile: true,
        totalBudget: 0,
        fundingSource: null,
        hasRab: false,
      }),
    ).toBeNull();
  });

  it('requires a file', () => {
    expect(submitProblem({ ...proposal, hasFile: false })).toMatch(/file/);
  });

  it('requires a proposal budget and funding source', () => {
    expect(submitProblem({ ...proposal, totalBudget: 0 })).toMatch(/budget/);
    expect(submitProblem({ ...proposal, fundingSource: null })).toMatch(/funding source/);
  });

  it('requires the RAB of a proposal', () => {
    expect(submitProblem({ ...proposal, hasRab: false })).toMatch(/RAB/);
  });
});

describe('lpjTooEarly', () => {
  const event = wibDay('2026-12-10');

  it('blocks submission until the event day has ended in WIB', () => {
    expect(lpjTooEarly(event, new Date('2026-12-10T16:59:00Z'))).toBe(true);
    expect(lpjTooEarly(event, new Date('2026-12-10T17:00:00Z'))).toBe(false);
  });

  it('blocks submission when the proker has no event date', () => {
    expect(lpjTooEarly(null, new Date())).toBe(true);
  });
});

describe('budgetDifference', () => {
  it('reports the realized budget against the approved one in rupiah and percent', () => {
    expect(budgetDifference(2_000_000, 1_700_000)).toEqual({
      approved: 2_000_000,
      realized: 1_700_000,
      rupiah: -300_000,
      percent: -15,
    });
  });

  it('has no percent when nothing was approved', () => {
    expect(budgetDifference(0, 50_000).percent).toBeNull();
  });
});

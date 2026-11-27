import type { Actor, ActorMembership } from '../../policy/domain/policy';
import { roleGroupOf, type Position } from '../../policy/domain/role-group';
import { nextStepFor, type InboxDocument } from './next-step';

const member = (position: Position, extra: Partial<ActorMembership> = {}): Actor => ({
  userId: `u-${position}`,
  isAdmin: false,
  membership: {
    id: `m-${position}`,
    position,
    roleGroup: roleGroupOf(position),
    kesekjenanId: null,
    departmentId: null,
    biroId: null,
    coversKesekjenanId: null,
    ...extra,
  },
});

const kadep = member('KEPALA_DEPARTEMEN', { departmentId: 'rt' });
const adm = member('SEKJEN_ADMINISTRASI_1', { coversKesekjenanId: 'k1' });
const keu = member('SEKJEN_KEUANGAN_1', { coversKesekjenanId: 'k1' });
const ketua = member('KETUA');
const staff = member('STAFF', { departmentId: 'rt' });

const doc = (
  status: InboxDocument['status'],
  extra: Partial<InboxDocument> = {},
): InboxDocument => ({
  status,
  adminApproved: false,
  financeApproved: false,
  scope: {
    departmentId: 'rt',
    kesekjenanId: 'k1',
    periodActive: true,
    authorId: 'u-STAFF',
    adminCovered: true,
    financeCovered: true,
  },
  ...extra,
});

describe('nextStepFor', () => {
  it('asks the Dept lead to submit a draft or a revision, and to carry an approved one on', () => {
    expect(nextStepFor(kadep, doc('DRAFT'))).toBe('SUBMIT');
    expect(nextStepFor(kadep, doc('REVISION'))).toBe('SUBMIT');
    expect(nextStepFor(kadep, doc('APPROVED'))).toBe('TO_KAPRODI');
    expect(nextStepFor(kadep, doc('AT_KAPRODI'))).toBe('SIGN');
    expect(nextStepFor(kadep, doc('SIGNED'))).toBe('ARCHIVE');
  });

  it('asks each covering Sekjen to review only their own part', () => {
    const halfDone = doc('IN_REVIEW', { adminApproved: true });

    expect(nextStepFor(adm, doc('IN_REVIEW'))).toBe('REVIEW');
    expect(nextStepFor(adm, halfDone)).toBeNull();
    expect(nextStepFor(keu, halfDone)).toBe('REVIEW');
  });

  it('asks the Ketua for the pengesahan of a reviewed document, never of their own', () => {
    expect(nextStepFor(ketua, doc('REVIEWED'))).toBe('PENGESAHAN');
    expect(
      nextStepFor(
        ketua,
        doc('REVIEWED', { scope: { ...doc('REVIEWED').scope, authorId: 'u-KETUA' } }),
      ),
    ).toBeNull();
  });

  it('asks nothing of people the rules do not name, or in a past period', () => {
    expect(nextStepFor(staff, doc('DRAFT'))).toBeNull();
    expect(nextStepFor(ketua, doc('IN_REVIEW'))).toBeNull();
    expect(nextStepFor(kadep, doc('ARCHIVED'))).toBeNull();
    expect(
      nextStepFor(kadep, doc('DRAFT', { scope: { ...doc('DRAFT').scope, periodActive: false } })),
    ).toBeNull();
  });
});

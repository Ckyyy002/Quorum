import { checkStatusChange } from './proker-status';

describe('proker status transitions (US-3.6)', () => {
  it('moves PLANNED to ONGOING', () => {
    expect(checkStatusChange('PLANNED', 'ONGOING', null)).toEqual({ ok: true });
  });

  it('cancels from PLANNED or ONGOING', () => {
    expect(checkStatusChange('PLANNED', 'CANCELLED', null).ok).toBe(true);
    expect(checkStatusChange('ONGOING', 'CANCELLED', null).ok).toBe(true);
  });

  it('rejects skipping ONGOING and leaving a final status as invalid', () => {
    expect(checkStatusChange('PLANNED', 'DONE', 'IN_REVIEW')).toMatchObject({ reason: 'invalid' });
    expect(checkStatusChange('DONE', 'ONGOING', null)).toMatchObject({ reason: 'invalid' });
    expect(checkStatusChange('CANCELLED', 'PLANNED', null)).toMatchObject({ reason: 'invalid' });
  });

  it('allows DONE only once the LPJ is in review or later', () => {
    expect(checkStatusChange('ONGOING', 'DONE', 'IN_REVIEW').ok).toBe(true);
    expect(checkStatusChange('ONGOING', 'DONE', 'SIGNED').ok).toBe(true);
  });

  it('rejects DONE as a conflict without an LPJ or with an LPJ still in draft', () => {
    expect(checkStatusChange('ONGOING', 'DONE', null)).toMatchObject({ reason: 'conflict' });
    expect(checkStatusChange('ONGOING', 'DONE', 'DRAFT')).toMatchObject({ reason: 'conflict' });
    expect(checkStatusChange('ONGOING', 'DONE', 'REVISION')).toMatchObject({ reason: 'conflict' });
  });
});

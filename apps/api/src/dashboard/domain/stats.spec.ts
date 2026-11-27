import { wibMonthStart } from '../../common/wib';
import { attendanceByKey, budgetTotals, prokerSummary } from './stats';

describe('prokerSummary', () => {
  it('counts proker per status and adds up their checklist progress', () => {
    expect(
      prokerSummary([
        { status: 'PLANNED', progress: { done: 1, total: 10 } },
        { status: 'ONGOING', progress: { done: 4, total: 8 } },
        { status: 'PLANNED', progress: { done: 0, total: 0 } },
      ]),
    ).toEqual({
      total: 3,
      byStatus: { PLANNED: 2, ONGOING: 1 },
      checklistDone: 5,
      checklistTotal: 18,
    });
  });
});

describe('attendanceByKey', () => {
  it('counts present and excused out of invited, per key', () => {
    const rates = attendanceByKey([
      { key: 'rt', status: 'PRESENT' },
      { key: 'rt', status: 'EXCUSED' },
      { key: 'rt', status: null },
      { key: 'ia', status: 'PRESENT' },
    ]);

    expect(rates.get('rt')).toEqual({ invited: 3, present: 1, excused: 1, percent: 33 });
    expect(rates.get('ia')).toEqual({ invited: 1, present: 1, excused: 0, percent: 100 });
    expect(rates.get('srd')).toBeUndefined();
  });
});

describe('budgetTotals (US-9.3)', () => {
  it('sums approved proposals and LPJ per funding source, skipping earlier stages', () => {
    const totals = budgetTotals([
      { type: 'PROPOSAL', status: 'APPROVED', totalBudget: 2_000_000, fundingSource: 'KAS_HMTC' },
      { type: 'PROPOSAL', status: 'ARCHIVED', totalBudget: 500_000, fundingSource: 'KAS_HMTC' },
      { type: 'PROPOSAL', status: 'IN_REVIEW', totalBudget: 9_000_000, fundingSource: 'KAS_HMTC' },
      { type: 'LPJ', status: 'SIGNED', totalBudget: 1_800_000, fundingSource: 'KAS_HMTC' },
      { type: 'LPJ', status: 'AT_KAPRODI', totalBudget: 100_000, fundingSource: null },
    ]);

    expect(totals).toEqual({
      proposal: { KAS_HMTC: 2_500_000 },
      lpj: { KAS_HMTC: 1_800_000, NONE: 100_000 },
      proposalTotal: 2_500_000,
      lpjTotal: 1_900_000,
    });
  });
});

describe('wibMonthStart', () => {
  it('starts the month at 00:00 WIB, even when UTC is still in the previous month', () => {
    // 30 Nov 17:30 UTC is already 1 Dec 00:30 WIB.
    expect(wibMonthStart(new Date('2026-11-30T17:30:00Z'))).toEqual(
      new Date('2026-11-30T17:00:00Z'),
    );
    expect(wibMonthStart(new Date('2026-11-27T12:00:00Z'))).toEqual(
      new Date('2026-10-31T17:00:00Z'),
    );
  });
});

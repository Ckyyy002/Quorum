import { wibDay } from '../../common/wib';
import { budgetTable, rabTotal, spjLate, spjProblem } from './budget';

describe('rabTotal', () => {
  it('sums quantity × unit price of every line', () => {
    // Arrange
    const lines = [
      { category: 'KONSUMSI' as const, quantity: 50, unitPrice: 20_000 },
      { category: 'CETAK' as const, quantity: 2, unitPrice: 150_000 },
    ];

    // Act / Assert
    expect(rabTotal(lines)).toBe(1_300_000);
    expect(rabTotal([])).toBe(0);
  });
});

describe('budgetTable', () => {
  const rab = [
    { category: 'KONSUMSI' as const, quantity: 10, unitPrice: 20_000 },
    { category: 'KONSUMSI' as const, quantity: 1, unitPrice: 50_000 },
    { category: 'ATK' as const, quantity: 5, unitPrice: 10_000 },
  ];

  it('totals the RAB per category in the Buku Biru order, skipping empty categories', () => {
    // Act
    const table = budgetTable(rab);

    // Assert
    expect(table.rows.map((r) => [r.category, r.rab])).toEqual([
      ['KONSUMSI', 250_000],
      ['ATK', 50_000],
    ]);
    expect(table.total).toEqual({ rab: 300_000, claimed: 0, verified: 0 });
  });

  it('compares SPJ with the RAB, ignoring returned items and listing categories outside the RAB', () => {
    // Arrange
    const spj = [
      { category: 'KONSUMSI' as const, amount: 200_000, status: 'VERIFIED' as const },
      { category: 'KONSUMSI' as const, amount: 30_000, status: 'PENDING' as const },
      { category: 'ATK' as const, amount: 99_000, status: 'RETURNED' as const },
      { category: 'HONOR' as const, amount: 100_000, status: 'PENDING' as const },
    ];

    // Act
    const table = budgetTable(rab, spj);

    // Assert
    expect(table.rows).toEqual([
      { category: 'KONSUMSI', rab: 250_000, claimed: 230_000, verified: 200_000 },
      { category: 'HONOR', rab: 0, claimed: 100_000, verified: 0 },
      { category: 'ATK', rab: 50_000, claimed: 0, verified: 0 },
    ]);
    expect(table.total).toEqual({ rab: 300_000, claimed: 330_000, verified: 200_000 });
  });
});

describe('spjLate', () => {
  const event = wibDay('2026-12-10');

  it('is on time until H+5 has ended in WIB', () => {
    expect(spjLate(event, new Date('2026-12-15T16:59:00Z'))).toBe(false);
    expect(spjLate(event, new Date('2026-12-15T17:00:00Z'))).toBe(true);
  });
});

describe('spjProblem', () => {
  const lpj = { type: 'LPJ' as const, status: 'DRAFT' as const, eventDate: wibDay('2026-12-10') };
  const after = new Date('2026-12-11T03:00:00Z');

  it('accepts an LPJ in DRAFT or REVISION after the event', () => {
    expect(spjProblem(lpj, after)).toBeNull();
    expect(spjProblem({ ...lpj, status: 'REVISION' }, after)).toBeNull();
  });

  it('rejects a proposal', () => {
    expect(spjProblem({ ...lpj, type: 'PROPOSAL' }, after)).toMatch(/LPJ/);
  });

  it('rejects uploads before the event day has ended or without an event date', () => {
    expect(spjProblem(lpj, new Date('2026-12-10T10:00:00Z'))).toMatch(/after the event/);
    expect(spjProblem({ ...lpj, eventDate: null }, after)).toMatch(/after the event/);
  });

  it('rejects changes once the LPJ is under review', () => {
    expect(spjProblem({ ...lpj, status: 'IN_REVIEW' }, after)).toMatch(/IN_REVIEW/);
  });
});

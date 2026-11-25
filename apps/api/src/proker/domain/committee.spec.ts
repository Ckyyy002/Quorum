import { checkCommittee, isCommitteeComplete } from './committee';

describe('committee rules (US-3.9)', () => {
  it('accepts a Sekben, a named Kepala Divisi and Anggota', () => {
    const seats = [
      { membershipId: 'a', role: 'SEKBEN' as const },
      { membershipId: 'b', role: 'KADIV' as const, divisionName: 'Acara' },
      { membershipId: 'c', role: 'ANGGOTA' as const },
    ];

    expect(checkCommittee(seats, 'pic')).toBeNull();
  });

  it('rejects the same member twice', () => {
    const seats = [
      { membershipId: 'a', role: 'SEKBEN' as const },
      { membershipId: 'a', role: 'ANGGOTA' as const },
    ];

    expect(checkCommittee(seats, 'pic')).toMatch(/only one committee role/);
  });

  it('rejects the PIC as another role, since the PIC is the Ketua Pelaksana', () => {
    expect(checkCommittee([{ membershipId: 'pic', role: 'ANGGOTA' }], 'pic')).toMatch(
      /Ketua Pelaksana/,
    );
  });

  it('rejects a Kepala Divisi without a division name', () => {
    expect(checkCommittee([{ membershipId: 'b', role: 'KADIV', divisionName: ' ' }], null)).toMatch(
      /division name/,
    );
  });

  it('requires Sekben and a Kepala Divisi only for PROYEK_BESAR', () => {
    expect(isCommitteeComplete('PROYEK_BESAR', true, ['SEKBEN'])).toBe(false);
    expect(isCommitteeComplete('PROYEK_BESAR', true, ['SEKBEN', 'KADIV', 'ANGGOTA'])).toBe(true);
    expect(isCommitteeComplete('AGENDA_MENENGAH', true, [])).toBe(true);
  });

  it('is never complete without a PIC', () => {
    expect(isCommitteeComplete('AGENDA_MENENGAH', false, [])).toBe(false);
  });
});

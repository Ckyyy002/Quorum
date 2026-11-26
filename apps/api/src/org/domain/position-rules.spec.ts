import { placeMembership, type PlacementInput } from './position-rules';

const dept = { id: 'dept-srd', kind: 'DEPARTMENT' as const };
const special = { id: 'biro-personalia', kind: 'SPECIAL_BIRO' as const };
const biro = { id: 'biro-kaderisasi', departmentId: 'dept-srd' };
const relasi = { id: 'k-relasi' };
const none = { departmentId: null, biroId: null, kesekjenanId: null, coversKesekjenanId: null };

const input = (over: Partial<PlacementInput>): PlacementInput => ({
  position: 'STAFF',
  department: null,
  biro: null,
  kesekjenan: null,
  coversKesekjenan: null,
  ...over,
});

describe('placeMembership', () => {
  it('places KETUA with no unit', () => {
    expect(placeMembership(input({ position: 'KETUA' }))).toEqual({
      ok: true,
      placement: none,
    });
  });

  it('places a Sekjen Bidang on the kesekjenan they oversee', () => {
    const result = placeMembership(input({ position: 'SEKJEN_BIDANG', kesekjenan: relasi }));

    expect(result).toEqual({ ok: true, placement: { ...none, kesekjenanId: 'k-relasi' } });
  });

  it('requires a Sekjen Bidang to name a kesekjenan', () => {
    expect(placeMembership(input({ position: 'SEKJEN_BIDANG' }))).toEqual({
      ok: false,
      error: 'SEKJEN_BIDANG needs kesekjenanId',
    });
  });

  it('rejects a Sekjen Bidang attached to a department', () => {
    expect(
      placeMembership(input({ position: 'SEKJEN_BIDANG', kesekjenan: relasi, department: dept }))
        .ok,
    ).toBe(false);
  });

  it('rejects an overseen kesekjenan on any other position', () => {
    expect(placeMembership(input({ position: 'SEKJEN_KEUANGAN_1', kesekjenan: relasi })).ok).toBe(
      false,
    );
  });

  it('rejects KETUA attached to a kesekjenan', () => {
    expect(placeMembership(input({ position: 'KETUA', kesekjenan: relasi })).ok).toBe(false);
  });

  it('requires Sekjen Administrasi to cover a kesekjenan', () => {
    const result = placeMembership(input({ position: 'SEKJEN_ADMINISTRASI_1' }));

    expect(result).toEqual({ ok: false, error: 'SEKJEN_ADMINISTRASI_1 needs coversKesekjenanId' });
  });

  it('places Sekjen Keuangan covering RELASI', () => {
    const result = placeMembership(
      input({ position: 'SEKJEN_KEUANGAN_2', coversKesekjenan: relasi }),
    );

    expect(result).toEqual({
      ok: true,
      placement: { ...none, coversKesekjenanId: 'k-relasi' },
    });
  });

  it('rejects coversKesekjenan on any other position', () => {
    expect(
      placeMembership(
        input({ position: 'KEPALA_DEPARTEMEN', department: dept, coversKesekjenan: relasi }),
      ).ok,
    ).toBe(false);
  });

  it('rejects a Sekjen Keuangan attached to a department', () => {
    expect(
      placeMembership(
        input({ position: 'SEKJEN_KEUANGAN_1', department: dept, coversKesekjenan: relasi }),
      ).ok,
    ).toBe(false);
  });

  it('places a Kadep in a department', () => {
    const result = placeMembership(input({ position: 'KEPALA_DEPARTEMEN', department: dept }));

    expect(result).toEqual({
      ok: true,
      placement: { ...none, departmentId: 'dept-srd' },
    });
  });

  it('rejects a Kadep without a department', () => {
    expect(placeMembership(input({ position: 'KEPALA_DEPARTEMEN' })).ok).toBe(false);
  });

  it('rejects a Sekdep in a special biro', () => {
    expect(
      placeMembership(input({ position: 'SEKRETARIS_DEPARTEMEN', department: special })).ok,
    ).toBe(false);
  });

  it('places staff in a biro and records the biro department', () => {
    const result = placeMembership(input({ position: 'STAFF', biro }));

    expect(result).toEqual({
      ok: true,
      placement: { ...none, departmentId: 'dept-srd', biroId: 'biro-kaderisasi' },
    });
  });

  it('rejects a Kabiro without a biro', () => {
    expect(placeMembership(input({ position: 'KEPALA_BIRO', department: dept })).ok).toBe(false);
  });

  it('rejects a biro that belongs to a different department', () => {
    const otherDept = { id: 'dept-sw', kind: 'DEPARTMENT' as const };

    expect(
      placeMembership(input({ position: 'WAKIL_KEPALA_BIRO', department: otherDept, biro })).ok,
    ).toBe(false);
  });

  it('places an Asisten Biro in a special biro', () => {
    const result = placeMembership(input({ position: 'ASISTEN_BIRO', department: special }));

    expect(result).toEqual({
      ok: true,
      placement: { ...none, departmentId: 'biro-personalia' },
    });
  });

  it('rejects an Asisten Biro without a unit', () => {
    expect(placeMembership(input({ position: 'ASISTEN_BIRO' })).ok).toBe(false);
  });

  it('rejects an Asisten Biro in a regular department', () => {
    expect(placeMembership(input({ position: 'ASISTEN_BIRO', department: dept })).ok).toBe(false);
  });
});

import { can, type Actor, type ActorMembership } from './policy';
import { bidangOf, roleGroupOf, type Position } from './role-group';

const member = (position: Position, over: Partial<ActorMembership> = {}): Actor => ({
  userId: 'u1',
  isAdmin: false,
  membership: {
    id: 'm1',
    position,
    roleGroup: roleGroupOf(position),
    kesekjenanId: null,
    departmentId: null,
    biroId: null,
    coversKesekjenanId: null,
    ...over,
  },
});
const admin: Actor = { userId: 'a', isAdmin: true, membership: null };
const guest: Actor = { userId: 'g', isAdmin: false, membership: null };

describe('role groups', () => {
  it('groups numbered and deputy positions with their leader', () => {
    expect(roleGroupOf('SEKJEN_ADMINISTRASI_2')).toBe('SEKJEN_ADM');
    expect(roleGroupOf('WAKIL_KEPALA_BIRO')).toBe('BIRO_LEAD');
    expect(roleGroupOf('ASISTEN_BIRO')).toBe('STAFF');
  });

  it('knows which kesekjenan a Sekjen Bidang oversees', () => {
    expect(bidangOf('SEKJEN_PERSONALIA')).toBe('PERSONALIA');
    expect(bidangOf('KETUA')).toBeNull();
  });
});

describe('policy', () => {
  it('lets only admins manage the structure', () => {
    expect(can(admin, 'org:manage')).toBe(true);
    expect(can(member('KETUA'), 'org:manage')).toBe(false);
    expect(can(guest, 'org:manage')).toBe(false);
  });

  describe('department:overview', () => {
    const scope = { departmentId: 'srd', kesekjenanId: 'pengembangan' };

    it('allows admin and Ketua everywhere', () => {
      expect(can(admin, 'department:overview', scope)).toBe(true);
      expect(can(member('KETUA'), 'department:overview', scope)).toBe(true);
    });

    it('allows the Sekjen Bidang of the kesekjenan, not another one', () => {
      const own = member('SEKJEN_PENGEMBANGAN', { kesekjenanId: 'pengembangan' });
      const other = member('SEKJEN_RELASI', { kesekjenanId: 'relasi' });

      expect(can(own, 'department:overview', scope)).toBe(true);
      expect(can(other, 'department:overview', scope)).toBe(false);
    });

    it('allows a Dept lead of that department only', () => {
      expect(
        can(member('SEKRETARIS_DEPARTEMEN', { departmentId: 'srd' }), 'department:overview', scope),
      ).toBe(true);
      expect(
        can(member('KEPALA_DEPARTEMEN', { departmentId: 'sw' }), 'department:overview', scope),
      ).toBe(false);
    });

    it('denies biro leads, staff and guests', () => {
      expect(
        can(member('KEPALA_BIRO', { departmentId: 'srd' }), 'department:overview', scope),
      ).toBe(false);
      expect(can(member('STAFF', { departmentId: 'srd' }), 'department:overview', scope)).toBe(
        false,
      );
      expect(can(guest, 'department:overview', scope)).toBe(false);
    });
  });

  describe('kesekjenan:overview', () => {
    const scope = { kesekjenanId: 'pengembangan' };

    it('allows the Sekjen Bidang of that kesekjenan and Ketua', () => {
      expect(
        can(
          member('SEKJEN_PENGEMBANGAN', { kesekjenanId: 'pengembangan' }),
          'kesekjenan:overview',
          scope,
        ),
      ).toBe(true);
      expect(can(member('KETUA'), 'kesekjenan:overview', scope)).toBe(true);
    });

    it('denies another Sekjen Bidang and a Dept lead', () => {
      expect(
        can(member('SEKJEN_RELASI', { kesekjenanId: 'relasi' }), 'kesekjenan:overview', scope),
      ).toBe(false);
      expect(
        can(
          member('KEPALA_DEPARTEMEN', { kesekjenanId: 'pengembangan' }),
          'kesekjenan:overview',
          scope,
        ),
      ).toBe(false);
    });
  });
});

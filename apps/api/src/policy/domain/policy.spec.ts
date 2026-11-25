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

  describe('proker rules (US-3)', () => {
    const proker = {
      departmentId: 'srd',
      kesekjenanId: 'pengembangan',
      biroId: 'kaderisasi',
      picMembershipId: 'pic',
      periodActive: true,
    };
    const kadep = member('KEPALA_DEPARTEMEN', { departmentId: 'srd' });
    const kabiro = member('KEPALA_BIRO', { departmentId: 'srd', biroId: 'kaderisasi' });
    const otherKabiro = member('KEPALA_BIRO', { departmentId: 'srd', biroId: 'riset' });
    const pic = member('STAFF', { id: 'pic', departmentId: 'srd', biroId: 'kaderisasi' });
    const staff = member('STAFF', { departmentId: 'srd', biroId: 'kaderisasi' });

    it('lets every member and the admin view detail, but not a guest', () => {
      expect(can(staff, 'proker:view')).toBe(true);
      expect(can(admin, 'proker:view')).toBe(true);
      expect(can(guest, 'proker:view')).toBe(false);
    });

    it('lets only the Dept lead of the department manage (create, delete, assign)', () => {
      expect(can(kadep, 'proker:manage', proker)).toBe(true);
      expect(
        can(member('KEPALA_DEPARTEMEN', { departmentId: 'ia' }), 'proker:manage', proker),
      ).toBe(false);
      expect(can(kabiro, 'proker:manage', proker)).toBe(false);
      expect(can(pic, 'proker:manage', proker)).toBe(false);
      expect(can(member('KETUA'), 'proker:manage', proker)).toBe(false);
    });

    it('treats the Sekjen Personalia as Dept lead of Biro Personalia only', () => {
      const sekjen = member('SEKJEN_PERSONALIA', { kesekjenanId: 'personalia' });
      const biroPersonalia = {
        departmentId: 'bp',
        kesekjenanId: 'personalia',
        specialBiro: true,
        periodActive: true,
      };

      expect(can(sekjen, 'proker:manage', biroPersonalia)).toBe(true);
      expect(can(sekjen, 'proker:manage', { ...biroPersonalia, specialBiro: false })).toBe(false);
    });

    it('lets Ketua, Dept lead, the executing biro lead and the PIC edit details', () => {
      expect(can(member('KETUA'), 'proker:edit', proker)).toBe(true);
      expect(can(kadep, 'proker:edit', proker)).toBe(true);
      expect(can(kabiro, 'proker:edit', proker)).toBe(true);
      expect(can(pic, 'proker:edit', proker)).toBe(true);
    });

    it('denies editing to another biro lead, staff and Sekjen Bidang', () => {
      expect(can(otherKabiro, 'proker:edit', proker)).toBe(false);
      expect(can(staff, 'proker:edit', proker)).toBe(false);
      expect(
        can(member('SEKJEN_PENGEMBANGAN', { kesekjenanId: 'pengembangan' }), 'proker:edit', proker),
      ).toBe(false);
    });

    it('lets the people running the proker change its status, not the Ketua', () => {
      expect(can(kabiro, 'proker:status', proker)).toBe(true);
      expect(can(pic, 'proker:status', proker)).toBe(true);
      expect(can(member('KETUA'), 'proker:status', proker)).toBe(false);
    });

    it('lets Dept lead, biro lead and PIC tick the checklist, not staff or Ketua', () => {
      expect(can(kadep, 'checklist:tick', proker)).toBe(true);
      expect(can(kabiro, 'checklist:tick', proker)).toBe(true);
      expect(can(pic, 'checklist:tick', proker)).toBe(true);
      expect(can(staff, 'checklist:tick', proker)).toBe(false);
      expect(can(member('KETUA'), 'checklist:tick', proker)).toBe(false);
    });

    it('lets only the Dept lead and the PIC set the committee', () => {
      expect(can(kadep, 'committee:set', proker)).toBe(true);
      expect(can(pic, 'committee:set', proker)).toBe(true);
      expect(can(kabiro, 'committee:set', proker)).toBe(false);
    });

    it('shows a biro overview to its leads and the units above, not to another biro or staff', () => {
      const biro = { departmentId: 'srd', kesekjenanId: 'pengembangan', biroId: 'kaderisasi' };

      expect(can(kabiro, 'biro:overview', biro)).toBe(true);
      expect(can(kadep, 'biro:overview', biro)).toBe(true);
      expect(
        can(member('SEKJEN_PENGEMBANGAN', { kesekjenanId: 'pengembangan' }), 'biro:overview', biro),
      ).toBe(true);
      expect(can(member('KETUA'), 'biro:overview', biro)).toBe(true);
      expect(can(otherKabiro, 'biro:overview', biro)).toBe(false);
      expect(can(staff, 'biro:overview', biro)).toBe(false);
      expect(can(member('SEKJEN_RELASI', { kesekjenanId: 'relasi' }), 'biro:overview', biro)).toBe(
        false,
      );
    });

    it('denies every write in a past period (G5)', () => {
      const past = { ...proker, periodActive: false };

      expect(can(kadep, 'proker:manage', past)).toBe(false);
      expect(can(member('KETUA'), 'proker:edit', past)).toBe(false);
      expect(can(pic, 'proker:status', past)).toBe(false);
      expect(can(pic, 'checklist:tick', past)).toBe(false);
      expect(can(pic, 'committee:set', past)).toBe(false);
    });
  });
});

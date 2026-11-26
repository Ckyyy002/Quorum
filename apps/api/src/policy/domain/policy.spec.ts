import { can, type Actor, type ActorMembership } from './policy';
import { roleGroupOf, type Position } from './role-group';

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
      const own = member('SEKJEN_BIDANG', { kesekjenanId: 'pengembangan' });
      const other = member('SEKJEN_BIDANG', { kesekjenanId: 'relasi' });

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
          member('SEKJEN_BIDANG', { kesekjenanId: 'pengembangan' }),
          'kesekjenan:overview',
          scope,
        ),
      ).toBe(true);
      expect(can(member('KETUA'), 'kesekjenan:overview', scope)).toBe(true);
    });

    it('denies another Sekjen Bidang and a Dept lead', () => {
      expect(
        can(member('SEKJEN_BIDANG', { kesekjenanId: 'relasi' }), 'kesekjenan:overview', scope),
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

    it('treats a Sekjen Bidang as Dept lead of a special biro in its own kesekjenan only', () => {
      const sekjen = member('SEKJEN_BIDANG', { kesekjenanId: 'personalia' });
      const biroPersonalia = {
        departmentId: 'bp',
        kesekjenanId: 'personalia',
        specialBiro: true,
        periodActive: true,
      };

      expect(can(sekjen, 'proker:manage', biroPersonalia)).toBe(true);
      expect(can(sekjen, 'proker:manage', { ...biroPersonalia, specialBiro: false })).toBe(false);
      expect(can(sekjen, 'proker:manage', { ...biroPersonalia, kesekjenanId: 'relasi' })).toBe(
        false,
      );
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
        can(member('SEKJEN_BIDANG', { kesekjenanId: 'pengembangan' }), 'proker:edit', proker),
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
        can(member('SEKJEN_BIDANG', { kesekjenanId: 'pengembangan' }), 'biro:overview', biro),
      ).toBe(true);
      expect(can(member('KETUA'), 'biro:overview', biro)).toBe(true);
      expect(can(otherKabiro, 'biro:overview', biro)).toBe(false);
      expect(can(staff, 'biro:overview', biro)).toBe(false);
      expect(can(member('SEKJEN_BIDANG', { kesekjenanId: 'relasi' }), 'biro:overview', biro)).toBe(
        false,
      );
    });

    describe('tasks (US-4)', () => {
      const task = { ...proker, assigneeMembershipId: 'assignee' };
      const assignee = member('STAFF', {
        id: 'assignee',
        departmentId: 'srd',
        biroId: 'kaderisasi',
      });

      it('lets the Dept lead, the executing biro lead and the PIC manage tasks', () => {
        expect(can(kadep, 'task:manage', task)).toBe(true);
        expect(can(kabiro, 'task:manage', task)).toBe(true);
        expect(can(pic, 'task:manage', task)).toBe(true);
      });

      it('denies managing tasks to the assignee, another biro lead and the Ketua', () => {
        expect(can(assignee, 'task:manage', task)).toBe(false);
        expect(can(otherKabiro, 'task:manage', task)).toBe(false);
        expect(can(member('KETUA'), 'task:manage', task)).toBe(false);
      });

      it('lets the assignee move their own task, but not other staff', () => {
        expect(can(assignee, 'task:status', task)).toBe(true);
        expect(can(staff, 'task:status', task)).toBe(false);
        expect(can(kabiro, 'task:status', task)).toBe(true);
      });

      it('denies task writes in a past period, even to the assignee (G5)', () => {
        const past = { ...task, periodActive: false };

        expect(can(kadep, 'task:manage', past)).toBe(false);
        expect(can(assignee, 'task:status', past)).toBe(false);
      });
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

  describe('documents (US-5)', () => {
    const doc = {
      kesekjenanId: 'pengembangan',
      departmentId: 'srd',
      biroId: 'kaderisasi',
      picMembershipId: 'pic',
      periodActive: true,
      authorId: 'author',
      documentStatus: 'IN_REVIEW',
      adminCovered: true,
      financeCovered: true,
    };
    const adm = (kesekjenan: string) =>
      member('SEKJEN_ADMINISTRASI_1', { coversKesekjenanId: kesekjenan });
    const keu = (kesekjenan: string) =>
      member('SEKJEN_KEUANGAN_2', { coversKesekjenanId: kesekjenan });

    it('lets D, B and P draft, but only the Dept lead submit', () => {
      const kadep = member('KEPALA_DEPARTEMEN', { departmentId: 'srd' });
      const kabiro = member('KEPALA_BIRO', { departmentId: 'srd', biroId: 'kaderisasi' });
      const picActor = member('STAFF', { id: 'pic', departmentId: 'srd' });

      expect(can(kadep, 'document:draft', doc)).toBe(true);
      expect(can(kabiro, 'document:draft', doc)).toBe(true);
      expect(can(picActor, 'document:draft', doc)).toBe(true);
      expect(can(member('STAFF', { departmentId: 'srd' }), 'document:draft', doc)).toBe(false);
      expect(can(kadep, 'document:submit', doc)).toBe(true);
      expect(can(kabiro, 'document:submit', doc)).toBe(false);
    });

    it('lets only the covering Sekjen Adm or Keu review', () => {
      expect(can(adm('pengembangan'), 'document:review', doc)).toBe(true);
      expect(can(keu('pengembangan'), 'document:review', doc)).toBe(true);
      expect(can(adm('relasi'), 'document:review', doc)).toBe(false);
      expect(can(member('KETUA'), 'document:review', doc)).toBe(false);
    });

    it('lets any Sekjen Adm or Keu review a kesekjenan nobody covers', () => {
      const uncovered = { ...doc, adminCovered: false, financeCovered: false };

      expect(can(adm('relasi'), 'document:review', uncovered)).toBe(true);
      expect(can(keu('relasi'), 'document:review', uncovered)).toBe(true);
    });

    it('never lets the author review or approve their own document (G9)', () => {
      const own = { ...doc, authorId: 'u1' };

      expect(can(adm('pengembangan'), 'document:review', own)).toBe(false);
      expect(can(member('KETUA'), 'document:approve', own)).toBe(false);
      expect(can(member('KETUA'), 'document:approve', doc)).toBe(true);
    });

    it('lets the Dept lead or the covering Sekjen Adm archive, not the Sekjen Keu', () => {
      expect(
        can(member('KEPALA_DEPARTEMEN', { departmentId: 'srd' }), 'document:archive', doc),
      ).toBe(true);
      expect(can(adm('pengembangan'), 'document:archive', doc)).toBe(true);
      expect(can(keu('pengembangan'), 'document:archive', doc)).toBe(false);
    });

    it('shows drafts only to people involved, and signed documents to every member', () => {
      const otherStaff = member('STAFF', { departmentId: 'ia' });
      const sekjenBidang = member('SEKJEN_BIDANG', { kesekjenanId: 'pengembangan' });

      expect(can(otherStaff, 'document:view', doc)).toBe(false);
      expect(can(member('STAFF', { departmentId: 'srd' }), 'document:view', doc)).toBe(true);
      expect(can(sekjenBidang, 'document:view', doc)).toBe(true);
      expect(can(adm('pengembangan'), 'document:view', doc)).toBe(true);
      expect(can(otherStaff, 'document:view', { ...doc, documentStatus: 'SIGNED' })).toBe(true);
      expect(can(guest, 'document:view', { ...doc, documentStatus: 'ARCHIVED' })).toBe(false);
    });

    it('blocks every document change in a past period (G5)', () => {
      const past = { ...doc, periodActive: false };

      expect(can(adm('pengembangan'), 'document:review', past)).toBe(false);
      expect(can(member('KETUA'), 'document:approve', past)).toBe(false);
      expect(
        can(member('KEPALA_DEPARTEMEN', { departmentId: 'srd' }), 'document:submit', past),
      ).toBe(false);
    });
  });
});

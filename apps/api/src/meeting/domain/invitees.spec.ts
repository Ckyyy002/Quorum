import { planInvitees, type Candidate } from './invitees';

const c = (id: string, over: Partial<Candidate>): Candidate => ({
  id,
  roleGroup: 'STAFF',
  kesekjenanId: null,
  departmentId: null,
  biroId: null,
  ...over,
});

const members: Candidate[] = [
  c('ketua', { roleGroup: 'KETUA' }),
  c('sekjen-peng', { roleGroup: 'SEKJEN_BIDANG', kesekjenanId: 'peng' }),
  c('sekjen-rel', { roleGroup: 'SEKJEN_BIDANG', kesekjenanId: 'rel' }),
  c('adm', { roleGroup: 'SEKJEN_ADM' }),
  c('keu', { roleGroup: 'SEKJEN_KEU' }),
  c('kadep-srd', { roleGroup: 'DEPT_LEAD', kesekjenanId: 'peng', departmentId: 'srd' }),
  c('kabiro', { roleGroup: 'BIRO_LEAD', kesekjenanId: 'peng', departmentId: 'srd', biroId: 'kad' }),
  c('staff-srd', { kesekjenanId: 'peng', departmentId: 'srd', biroId: 'kad' }),
  c('staff-srd-2', { kesekjenanId: 'peng', departmentId: 'srd' }),
  c('kadep-ia', { roleGroup: 'DEPT_LEAD', kesekjenanId: 'rel', departmentId: 'ia' }),
];

const ids = (plan: { membershipId: string; optional: boolean }[], optional = false) =>
  plan
    .filter((p) => p.optional === optional)
    .map((p) => p.membershipId)
    .sort();

describe('planInvitees', () => {
  it('BPH: the Ketua and every Sekjen', () => {
    const plan = planInvitees('BPH', {}, members, 'adm');

    expect(ids(plan)).toEqual(['adm', 'ketua', 'keu', 'sekjen-peng', 'sekjen-rel']);
  });

  it('KABINET: BPH plus every Dept lead', () => {
    const plan = planInvitees('KABINET', {}, members, 'ketua');

    expect(ids(plan)).toEqual(
      ['adm', 'kadep-ia', 'kadep-srd', 'keu', 'ketua', 'sekjen-peng', 'sekjen-rel'].sort(),
    );
  });

  it('KESEKJENAN: the Sekjen Bidang and every element of its departments', () => {
    const plan = planInvitees('KESEKJENAN', { kesekjenanId: 'peng' }, members, 'sekjen-peng');

    expect(ids(plan)).toEqual(['kabiro', 'kadep-srd', 'sekjen-peng', 'staff-srd', 'staff-srd-2']);
  });

  it('DEPARTEMEN: the department, with its Sekjen Bidang as optional visitor', () => {
    const plan = planInvitees(
      'DEPARTEMEN',
      { departmentId: 'srd', kesekjenanId: 'peng' },
      members,
      'kadep-srd',
    );

    expect(ids(plan)).toEqual(['kabiro', 'kadep-srd', 'staff-srd', 'staff-srd-2']);
    expect(ids(plan, true)).toEqual(['sekjen-peng']);
  });

  it('BIRO: the biro and the organizer', () => {
    const plan = planInvitees('BIRO', { biroId: 'kad' }, members, 'kabiro');

    expect(ids(plan)).toEqual(['kabiro', 'staff-srd']);
  });

  it('PROKER: the committee, plus a Dept lead who organizes it', () => {
    const plan = planInvitees(
      'PROKER',
      { committeeIds: ['staff-srd', 'staff-srd-2'] },
      members,
      'kadep-srd',
    );

    expect(ids(plan)).toEqual(['kadep-srd', 'staff-srd', 'staff-srd-2']);
  });

  it('adds extra people as optional, without downgrading a default invitee', () => {
    const plan = planInvitees('BIRO', { biroId: 'kad' }, members, 'kabiro', ['ketua', 'staff-srd']);

    expect(ids(plan)).toEqual(['kabiro', 'staff-srd']);
    expect(ids(plan, true)).toEqual(['ketua']);
  });
});

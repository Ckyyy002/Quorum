import { documentAudience, reviewersFor, uniqueRecipients, type Sekjen } from './audience';

const person = (userId: string) => ({ userId, name: userId, email: `${userId}@quorum.test` });

describe('documentAudience (US-5)', () => {
  it('hands a submitted document to the reviewers, a reviewed one to the Ketua', () => {
    expect(documentAudience('DRAFT', 'IN_REVIEW')).toBe('REVIEWERS');
    expect(documentAudience('REVISION', 'IN_REVIEW')).toBe('REVIEWERS');
    expect(documentAudience('IN_REVIEW', 'REVIEWED')).toBe('KETUA');
  });

  it('tells the drafters about a return and about the pengesahan', () => {
    expect(documentAudience('IN_REVIEW', 'REVISION')).toBe('DRAFTERS');
    expect(documentAudience('REVIEWED', 'REVISION')).toBe('DRAFTERS');
    expect(documentAudience('REVIEWED', 'APPROVED')).toBe('DRAFTERS');
  });

  it('stays quiet for a partial approval and for the drafters’ own later steps', () => {
    expect(documentAudience('IN_REVIEW', 'IN_REVIEW')).toBeNull();
    expect(documentAudience('APPROVED', 'AT_KAPRODI')).toBeNull();
    expect(documentAudience('AT_KAPRODI', 'SIGNED')).toBeNull();
    expect(documentAudience('SIGNED', 'ARCHIVED')).toBeNull();
  });
});

describe('reviewersFor', () => {
  const sekjen = (id: string, position: Sekjen['position'], covers: string | null): Sekjen => ({
    ...person(id),
    position,
    coversKesekjenanId: covers,
  });
  const all = [
    sekjen('adm1', 'SEKJEN_ADMINISTRASI_1', 'k1'),
    sekjen('adm2', 'SEKJEN_ADMINISTRASI_2', 'k2'),
    sekjen('keu1', 'SEKJEN_KEUANGAN_1', 'k1'),
    sekjen('keu2', 'SEKJEN_KEUANGAN_2', 'k2'),
  ];
  const ids = (list: { userId: string }[]) => list.map((r) => r.userId);

  it('picks the Sekjen Adm and Keu who cover the kesekjenan', () => {
    expect(ids(reviewersFor(all, 'k1'))).toEqual(['adm1', 'keu1']);
  });

  it('falls back to every holder of a role nobody covers it with', () => {
    expect(ids(reviewersFor(all, 'k3'))).toEqual(['adm1', 'adm2', 'keu1', 'keu2']);
    expect(ids(reviewersFor([all[0]!, all[2]!, all[3]!], 'k2'))).toEqual(['adm1', 'keu2']);
  });
});

describe('uniqueRecipients', () => {
  it('drops duplicates and the person who caused the change', () => {
    const list = [person('a'), person('b'), person('a'), person('c')];

    expect(uniqueRecipients(list, 'c').map((r) => r.userId)).toEqual(['a', 'b']);
  });
});

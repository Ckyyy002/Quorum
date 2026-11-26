import type { Me } from '@/features/auth/auth-api';
import { prokerRights } from '@/features/proker/permissions';
import type { ProkerDetail } from '@/features/proker/proker-api';
import type { DocumentDetail } from './document-api';

/**
 * Which document buttons to show. A simplified mirror of the `document:*` rules in
 * apps/api/src/policy/domain/policy.ts plus the state machine; the API still decides every request.
 */
export function documentRights(me: Me, proker: ProkerDetail, doc: DocumentDetail) {
  const m = me.membership;
  const { manage: leadsDepartment, status: runsProker } = prokerRights(me, proker);
  const notAuthor = doc.author.id !== me.id;
  const editable = doc.status === 'DRAFT' || doc.status === 'REVISION';
  const covers = m?.coversKesekjenan?.id === proker.department.kesekjenanId;
  const inReview = doc.status === 'IN_REVIEW' && notAuthor;
  // A Sekjen who can see a document under review covers it (or nobody does), so the role is enough here.
  const reviewsAdmin = m?.roleGroup === 'SEKJEN_ADM' && inReview && !doc.adminApprovedBy;
  const reviewsFinance = m?.roleGroup === 'SEKJEN_KEU' && inReview && !doc.financeApprovedBy;

  return {
    edit: runsProker && editable,
    submit: leadsDepartment && editable,
    review: reviewsAdmin || reviewsFinance,
    pengesahan: m?.roleGroup === 'KETUA' && doc.status === 'REVIEWED' && notAuthor,
    kaprodiDiscussion:
      leadsDepartment && doc.deadlines.some((d) => d.step === 'KAPRODI_DISCUSSION' && !d.doneAt),
    toKaprodi: leadsDepartment && doc.status === 'APPROVED',
    sign: leadsDepartment && doc.status === 'AT_KAPRODI',
    archive:
      doc.status === 'SIGNED' && (leadsDepartment || (m?.roleGroup === 'SEKJEN_ADM' && covers)),
  };
}

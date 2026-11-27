import type { DocumentStatus } from '../../document/domain/document-workflow';
import { roleGroupOf, type Position } from '../../policy/domain/role-group';

/** Someone to email. */
export interface Recipient {
  userId: string;
  name: string;
  email: string;
}

/** Who acts next on a document, by the status it moved to (US-5). */
export type DocumentAudience = 'REVIEWERS' | 'KETUA' | 'DRAFTERS';

/**
 * Only steps that hand the document to someone else send mail. A partial approval (one Sekjen approved,
 * the other has not) keeps the status, so `from === to` sends nothing.
 */
export function documentAudience(
  from: DocumentStatus,
  to: DocumentStatus,
): DocumentAudience | null {
  if (from === to) return null;
  switch (to) {
    case 'IN_REVIEW':
      return 'REVIEWERS';
    case 'REVIEWED':
      return 'KETUA';
    case 'REVISION': // returned with a note: the drafters revise
    case 'APPROVED': // pengesahan done: the drafters take it to the Kaprodi
      return 'DRAFTERS';
    default:
      return null;
  }
}

export interface Sekjen extends Recipient {
  position: Position;
  coversKesekjenanId: string | null;
}

/**
 * The Sekjen Adm and Sekjen Keu who review a document of this kesekjenan: those covering it, or every
 * holder of that role when nobody covers it (same rule as `coversAdmin` / `coversFinance` in the policy).
 */
export function reviewersFor(sekjens: readonly Sekjen[], kesekjenanId: string): Recipient[] {
  return (['SEKJEN_ADM', 'SEKJEN_KEU'] as const).flatMap((group) => {
    const holders = sekjens.filter((s) => roleGroupOf(s.position) === group);
    const covering = holders.filter((s) => s.coversKesekjenanId === kesekjenanId);
    return covering.length > 0 ? covering : holders;
  });
}

/** One email per person, and never to the person who caused it. */
export function uniqueRecipients(
  recipients: readonly Recipient[],
  exceptUserId?: string,
): Recipient[] {
  const seen = new Set<string>();
  return recipients.filter((r) => {
    if (r.userId === exceptUserId || seen.has(r.userId)) return false;
    seen.add(r.userId);
    return true;
  });
}

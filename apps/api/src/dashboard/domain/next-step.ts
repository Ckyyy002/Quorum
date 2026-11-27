import {
  transition,
  type DocumentAction,
  type DocumentStatus,
} from '../../document/domain/document-workflow';
import { can, type Action, type Actor, type Scope } from '../../policy/domain/policy';

/** What the dashboard asks the user to do with a document ("Perlu tindakanmu"). */
export type NextStep = 'SUBMIT' | 'REVIEW' | 'PENGESAHAN' | 'TO_KAPRODI' | 'SIGN' | 'ARCHIVE';

export interface InboxDocument {
  status: DocumentStatus;
  adminApproved: boolean;
  financeApproved: boolean;
  /** The policy scope of the document (department, kesekjenan, author, coverage, period). */
  scope: Scope;
}

/**
 * The same two checks the API runs when the button is pressed: the policy rule allows this person, and the
 * workflow allows the step from the current state. Nothing is decided here that the endpoints do not decide.
 */
const STEPS: { step: NextStep; rule: Action; action: (actor: Actor) => DocumentAction }[] = [
  { step: 'SUBMIT', rule: 'document:submit', action: () => 'SUBMIT' },
  {
    step: 'REVIEW',
    rule: 'document:review',
    // The reviewer's part follows their position, as in DocumentService.review.
    action: (a) => (a.membership?.roleGroup === 'SEKJEN_ADM' ? 'APPROVE_ADMIN' : 'APPROVE_FINANCE'),
  },
  { step: 'PENGESAHAN', rule: 'document:approve', action: () => 'APPROVE' },
  { step: 'TO_KAPRODI', rule: 'document:submit', action: () => 'TO_KAPRODI' },
  { step: 'SIGN', rule: 'document:submit', action: () => 'SIGN' },
  { step: 'ARCHIVE', rule: 'document:archive', action: () => 'ARCHIVE' },
];

export function nextStepFor(actor: Actor, doc: InboxDocument): NextStep | null {
  const scope = { ...doc.scope, documentStatus: doc.status };
  const found = STEPS.find((s) => can(actor, s.rule, scope) && transition(doc, s.action(actor)).ok);
  return found?.step ?? null;
}

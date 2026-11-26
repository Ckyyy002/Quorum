import type { DocumentAction, DocumentStatus } from './domain/document-workflow';

/**
 * Emitted after every workflow step commits (submit, each review, pengesahan, Kaprodi, archive). The
 * notification module will listen and email the next people in line; the document module never imports
 * the mailer (architecture rule 4).
 */
export class DocumentStatusChanged {
  static readonly event = 'document.status-changed';
  constructor(
    readonly documentId: string,
    readonly action: DocumentAction,
    readonly from: DocumentStatus,
    readonly to: DocumentStatus,
    readonly actorId: string,
  ) {}
}

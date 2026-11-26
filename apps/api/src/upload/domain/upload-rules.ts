/** Rule 8 limits for evidence files. 10 MB fits photos, scans and Office files (decided by the user). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** MIME type detected from the magic bytes → extension used for the stored name. */
export const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};

const PDF = 'application/pdf';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Which detected types a kind of upload accepts, and how to name them in the 400 message. */
export interface Accept {
  types: Record<string, string>;
  label: string;
}

export const EVIDENCE_FILES: Accept = {
  types: ALLOWED_TYPES,
  label: 'JPG, PNG, WebP, PDF, DOCX, XLSX or PPTX',
};
/** US-5.1 AC1: proposal and LPJ drafts. */
export const DOCUMENT_FILES: Accept = {
  types: { [PDF]: 'pdf', [DOCX]: 'docx' },
  label: 'PDF or DOCX',
};
/** US-5.6 AC2: the Kaprodi-signed scan. */
export const SIGNED_FILES: Accept = { types: { [PDF]: 'pdf' }, label: 'PDF' };

export type UploadCheck = { ok: true; mime: string; ext: string } | { ok: false; error: string };

/**
 * Trusts the file's content, not the client: the type read from the magic bytes must be allowed, and the
 * type the browser declared must agree with it (`application/octet-stream` means "unknown" and is let through).
 */
export function checkUpload(
  declared: string,
  detected: { mime: string } | undefined,
  accept: Accept = EVIDENCE_FILES,
): UploadCheck {
  const ext = detected && accept.types[detected.mime];
  if (!detected || !ext) return { ok: false, error: `Only ${accept.label} files are accepted` };
  if (declared !== detected.mime && declared !== 'application/octet-stream') {
    return { ok: false, error: 'The file content does not match its type' };
  }
  return { ok: true, mime: detected.mime, ext };
}

/** Display name only (the stored name is random): no folders, no control characters, bounded length. */
export function safeDisplayName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return clean.slice(-200) || 'bukti';
}

/** Evidence is a link or a file; either one is enough (decided by the user). */
export function hasEvidence(x: { evidenceUrl?: string | null; evidenceFileId?: string | null }) {
  return !!x.evidenceUrl || !!x.evidenceFileId;
}

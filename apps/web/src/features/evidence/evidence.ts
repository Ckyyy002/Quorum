import { api } from '@/lib/api';

/** Mirrors the API's evidence fields (apps/api/src/upload). */
export interface EvidenceFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface Evidence {
  evidenceUrl: string | null;
  evidenceFile: EvidenceFile | null;
}

/** Same rule as the API's `hasEvidence`: a link or a file is enough. */
export const hasEvidence = (e: Evidence) => !!e.evidenceUrl || !!e.evidenceFile;

// Same limits as apps/api/src/upload/domain/upload-rules.ts; the API checks the content again.
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
export const EVIDENCE_ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx,.pptx';

/** Multipart body for PUT …/evidence: the link and/or the file. */
export function evidenceForm(input: { evidenceUrl?: string; file?: File }): FormData {
  const form = new FormData();
  if (input.evidenceUrl !== undefined) form.append('evidenceUrl', input.evidenceUrl);
  if (input.file) form.append('file', input.file);
  return form;
}

/**
 * The access token lives in memory, so a plain <a href> would arrive without it. The file is fetched
 * through the API client and handed to the browser as a download.
 */
export async function downloadEvidence(path: string, filename: string): Promise<void> {
  const res = await api.get<Blob>(path, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

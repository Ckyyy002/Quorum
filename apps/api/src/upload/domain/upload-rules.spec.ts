import { checkUpload, hasEvidence, safeDisplayName } from './upload-rules';

describe('checkUpload', () => {
  it('accepts an allowed type whose content matches the declared type', () => {
    expect(checkUpload('application/pdf', { mime: 'application/pdf' })).toEqual({
      ok: true,
      mime: 'application/pdf',
      ext: 'pdf',
    });
  });

  it('accepts an unknown declared type when the content is allowed', () => {
    const docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    expect(checkUpload('application/octet-stream', { mime: docx })).toMatchObject({ ext: 'docx' });
  });

  it('rejects content that is not an allowed type, or cannot be recognised', () => {
    expect(checkUpload('application/zip', { mime: 'application/zip' }).ok).toBe(false);
    expect(checkUpload('text/plain', undefined).ok).toBe(false);
  });

  it('rejects a file renamed to look like another type', () => {
    expect(checkUpload('application/pdf', { mime: 'image/png' })).toEqual({
      ok: false,
      error: 'The file content does not match its type',
    });
  });
});

describe('safeDisplayName', () => {
  it('drops folders and control characters and falls back when nothing is left', () => {
    expect(safeDisplayName('../../etc/passwd')).toBe('passwd');
    expect(safeDisplayName('C:\\Users\\x\\foto\u0007.jpg')).toBe('foto.jpg');
    expect(safeDisplayName('/')).toBe('bukti');
  });
});

describe('hasEvidence', () => {
  it('needs a link or a file', () => {
    expect(hasEvidence({ evidenceUrl: 'https://x.y' })).toBe(true);
    expect(hasEvidence({ evidenceFileId: 'f1' })).toBe(true);
    expect(hasEvidence({ evidenceUrl: null, evidenceFileId: null })).toBe(false);
  });
});

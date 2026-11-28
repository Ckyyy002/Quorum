import { NotFoundException } from '@nestjs/common';
import type { UploadService } from '../upload/upload.service';
import { BudgetService } from './budget.service';
import type { DocumentRepository } from './document.repository';
import type { DocumentService } from './document.service';

/**
 * The failures the e2e tests cannot trigger on demand: a database write failing after the receipt is on disk.
 * Everything else about RAB and SPJ is covered in test/document.e2e-spec.ts.
 */
describe('BudgetService', () => {
  const file = { buffer: Buffer.from('%PDF'), mimetype: 'application/pdf' } as Express.Multer.File;
  const lpj = {
    id: 'lpj',
    type: 'LPJ',
    status: 'DRAFT',
    proker: { eventDate: new Date('2026-01-01T00:00:00+07:00') },
  };
  const dbDown = new Error('database down');

  function setup(found: object | null) {
    const documents = {
      findForWrite: jest.fn().mockResolvedValue(found),
      findSpj: jest.fn().mockResolvedValue({ id: 'item', status: 'RETURNED', fileId: 'old-file' }),
      createSpj: jest.fn().mockRejectedValue(dbDown),
      updateSpj: jest.fn().mockRejectedValue(dbDown),
    };
    const uploads = {
      store: jest.fn().mockResolvedValue({ id: 'new-file' }),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const service = new BudgetService(
      documents as unknown as DocumentRepository,
      { get: jest.fn() } as unknown as DocumentService,
      uploads as unknown as UploadService,
    );
    return { service, uploads };
  }

  it('removes the stored receipt when the new SPJ item cannot be saved', async () => {
    const { service, uploads } = setup(lpj);

    const result = service.addSpj(
      'lpj',
      { category: 'ATK', description: 'x', amount: 1 },
      file,
      'u',
    );

    await expect(result).rejects.toBe(dbDown);
    expect(uploads.remove).toHaveBeenCalledWith('new-file');
  });

  it('keeps the old receipt and drops the new one when a fix cannot be saved', async () => {
    const { service, uploads } = setup(lpj);

    const result = service.updateSpj('lpj', 'item', { amount: 2 }, file, 'u');

    await expect(result).rejects.toBe(dbDown);
    expect(uploads.remove).toHaveBeenCalledWith('new-file');
    expect(uploads.remove).not.toHaveBeenCalledWith('old-file');
  });

  it('answers 404 when the document disappeared after the guard loaded it', async () => {
    const { service } = setup(null);

    await expect(service.setRab('lpj', { lines: [] }, 'u')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

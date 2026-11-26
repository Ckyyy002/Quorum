import { ConflictException, NotFoundException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { PolicyService } from '../policy/policy.service';
import type { UploadService } from '../upload/upload.service';
import type { DocumentRepository } from './document.repository';
import { DocumentService } from './document.service';

/**
 * The races the e2e tests cannot trigger on demand. Everything else about documents is covered end to end
 * in test/document.e2e-spec.ts.
 */
describe('DocumentService', () => {
  const file = { buffer: Buffer.from('%PDF'), mimetype: 'application/pdf' } as Express.Multer.File;
  const atKaprodi = {
    id: 'doc',
    status: 'AT_KAPRODI',
    version: 1,
    adminApprovedById: 'adm',
    financeApprovedById: 'keu',
    updatedAt: new Date(),
    deadlines: [],
  };

  function setup(found: object | null, saved = true) {
    const documents = {
      findForWrite: jest.fn().mockResolvedValue(found),
      record: jest.fn().mockResolvedValue(saved),
    };
    const uploads = {
      store: jest.fn().mockResolvedValue({ id: 'signed-file' }),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    const policy = { actorFor: jest.fn().mockResolvedValue({ membership: null }) };
    const service = new DocumentService(
      documents as unknown as DocumentRepository,
      uploads as unknown as UploadService,
      policy as unknown as PolicyService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );
    return { service, uploads };
  }

  it('removes the stored signed PDF when another request changed the document first', async () => {
    // Arrange: the state check passes, but the conditional update matches no row.
    const { service, uploads } = setup(atKaprodi, false);

    // Act
    const result = service.sign('doc', file, 'kadep');

    // Assert
    await expect(result).rejects.toBeInstanceOf(ConflictException);
    expect(uploads.remove).toHaveBeenCalledWith('signed-file');
  });

  it('answers 404 when the document disappeared after the guard loaded it', async () => {
    const { service } = setup(null);

    await expect(service.archive('doc', 'kadep')).rejects.toBeInstanceOf(NotFoundException);
  });
});

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fileTypeFromBuffer } from 'file-type';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { checkUpload, safeDisplayName } from './domain/upload-rules';
import { UploadRepository } from './upload.repository';

/** Files on local disk under UPLOAD_DIR, metadata in FileAttachment (rule 8). Size is capped by Multer (413). */
@Injectable()
export class UploadService {
  private readonly dir: string;

  constructor(
    private readonly files: UploadRepository,
    config: ConfigService,
  ) {
    this.dir = resolve(config.get<string>('UPLOAD_DIR') ?? 'uploads');
  }

  /** Checks the content, writes it under a random name and records it. 400 for a type that is not allowed. */
  async storeEvidence(file: Express.Multer.File, userId: string) {
    const check = checkUpload(file.mimetype, await fileTypeFromBuffer(file.buffer));
    if (!check.ok) throw new BadRequestException(check.error);

    const path = `${randomUUID()}.${check.ext}`;
    await mkdir(this.dir, { recursive: true });
    await writeFile(join(this.dir, path), file.buffer);
    return this.files.create({
      path,
      mimeType: check.mime,
      size: file.size,
      originalName: safeDisplayName(file.originalname),
      kind: 'EVIDENCE',
      uploadedById: userId,
    });
  }

  /** Stream + headers for a download; `attachment` so the browser never renders it inline. */
  async open(id: string | null | undefined) {
    const file = id ? await this.files.findById(id) : null;
    if (!file) throw new NotFoundException('No evidence file');
    return {
      stream: createReadStream(join(this.dir, file.path)),
      type: file.mimeType,
      length: file.size,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
    };
  }

  /** Called after a replacement or delete has committed; a file already gone from disk is fine. */
  async remove(id: string | null | undefined): Promise<void> {
    if (!id) return;
    const file = await this.files.findById(id);
    if (!file) return;
    await this.files.delete(id);
    await unlink(join(this.dir, file.path)).catch(() => undefined);
  }
}

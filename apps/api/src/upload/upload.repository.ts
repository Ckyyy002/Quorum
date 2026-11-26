import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** What a client sees of an evidence file; the disk path never leaves the API. */
export const EVIDENCE_FILE_SELECT = {
  id: true,
  originalName: true,
  mimeType: true,
  size: true,
} satisfies Prisma.FileAttachmentSelect;

@Injectable()
export class UploadRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.FileAttachmentUncheckedCreateInput) {
    return this.prisma.fileAttachment.create({ data });
  }

  findById(id: string) {
    return this.prisma.fileAttachment.findUnique({ where: { id } });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.fileAttachment.delete({ where: { id } });
  }
}

import { Module } from '@nestjs/common';
import { UploadModule } from '../upload/upload.module';
import { DocumentController } from './document.controller';
import { DocumentRepository } from './document.repository';
import { DocumentService } from './document.service';

/** Proposal and LPJ: drafts and versions, review, pengesahan, Kaprodi steps and H-n deadlines (US-5). */
@Module({
  imports: [UploadModule],
  controllers: [DocumentController],
  providers: [DocumentRepository, DocumentService],
})
export class DocumentModule {}

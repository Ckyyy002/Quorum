import { Module } from '@nestjs/common';
import { UploadModule } from '../upload/upload.module';
import { BudgetController } from './budget.controller';
import { BudgetService } from './budget.service';
import { DocumentController } from './document.controller';
import { DocumentRepository } from './document.repository';
import { DocumentService } from './document.service';

/** Proposal and LPJ: drafts and versions, review, pengesahan, Kaprodi steps and H-n deadlines (US-5);
 * RAB and SPJ (US-13). */
@Module({
  imports: [UploadModule],
  controllers: [DocumentController, BudgetController],
  providers: [DocumentRepository, DocumentService, BudgetService],
})
export class DocumentModule {}

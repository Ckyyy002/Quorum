import { Module } from '@nestjs/common';
import { UploadModule } from '../upload/upload.module';
import { ProkerController } from './proker.controller';
import { ProkerRepository } from './proker.repository';
import { ProkerService } from './proker.service';

/** Proker, their PIC and executing biro, status, committee and checklist. */
@Module({
  imports: [UploadModule],
  controllers: [ProkerController],
  providers: [ProkerRepository, ProkerService],
  // Org overviews show proker progress (US-2.7, 2.8, 3.5).
  exports: [ProkerService],
})
export class ProkerModule {}

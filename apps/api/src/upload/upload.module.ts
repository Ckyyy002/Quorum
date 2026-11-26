import { Module } from '@nestjs/common';
import { UploadRepository } from './upload.repository';
import { UploadService } from './upload.service';

/** Storing and serving files; no routes of its own, used by task and proker (and documents in US-5). */
@Module({
  providers: [UploadRepository, UploadService],
  exports: [UploadService],
})
export class UploadModule {}

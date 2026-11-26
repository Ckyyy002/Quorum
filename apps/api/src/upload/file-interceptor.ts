import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MAX_UPLOAD_BYTES } from './domain/upload-rules';

/**
 * One optional `file` field, kept in memory so its magic bytes can be checked before anything touches
 * the disk. Over the limit Multer stops reading and Nest answers 413.
 */
export const EvidenceFileInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

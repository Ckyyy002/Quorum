import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { MAX_AVATAR_BYTES, MAX_UPLOAD_BYTES } from './domain/upload-rules';

/**
 * One optional `file` field, kept in memory so its magic bytes can be checked before anything touches
 * the disk. Over the limit Multer stops reading and Nest answers 413.
 */
export const SingleFileInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

/** US-1.5 AC2: same, with the 2 MB avatar limit (413 above it). */
export const AvatarFileInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: MAX_AVATAR_BYTES, files: 1 },
});

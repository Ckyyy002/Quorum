-- US-6.3: the optional minutes file is a FileAttachment (rule 8: metadata in FileAttachment, random name on
-- disk) instead of a bare path. No minutes exist yet, so the old column is dropped without converting data.
ALTER TYPE "AttachmentKind" ADD VALUE 'MINUTES';

ALTER TABLE "Minutes" DROP COLUMN "filePath",
ADD COLUMN "fileId" TEXT;

CREATE UNIQUE INDEX "Minutes_fileId_key" ON "Minutes"("fileId");

ALTER TABLE "Minutes" ADD CONSTRAINT "Minutes_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "FileAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

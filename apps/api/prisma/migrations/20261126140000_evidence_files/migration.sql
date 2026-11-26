-- AlterEnum
ALTER TYPE "AttachmentKind" ADD VALUE 'EVIDENCE';

-- AlterTable
ALTER TABLE "ChecklistItem" ADD COLUMN     "evidenceFileId" TEXT;

-- AlterTable
ALTER TABLE "FileAttachment" ALTER COLUMN "documentId" DROP NOT NULL,
ALTER COLUMN "version" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "evidenceFileId" TEXT,
ADD COLUMN     "evidenceUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItem_evidenceFileId_key" ON "ChecklistItem"("evidenceFileId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_evidenceFileId_key" ON "Task"("evidenceFileId");

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_evidenceFileId_fkey" FOREIGN KEY ("evidenceFileId") REFERENCES "FileAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_evidenceFileId_fkey" FOREIGN KEY ("evidenceFileId") REFERENCES "FileAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;


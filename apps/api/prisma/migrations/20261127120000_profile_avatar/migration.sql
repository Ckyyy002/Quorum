-- AlterEnum
ALTER TYPE "AttachmentKind" ADD VALUE 'AVATAR';

-- AlterTable: avatarPath was never written, so dropping it loses nothing.
ALTER TABLE "User" DROP COLUMN "avatarPath",
ADD COLUMN     "avatarFileId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_avatarFileId_key" ON "User"("avatarFileId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_avatarFileId_fkey" FOREIGN KEY ("avatarFileId") REFERENCES "FileAttachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;


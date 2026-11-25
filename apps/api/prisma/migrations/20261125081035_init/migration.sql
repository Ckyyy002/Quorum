-- CreateEnum
CREATE TYPE "Position" AS ENUM ('KETUA', 'SEKJEN_PENGEMBANGAN', 'SEKJEN_RELASI', 'SEKJEN_PERSONALIA', 'SEKJEN_ADMINISTRASI_1', 'SEKJEN_ADMINISTRASI_2', 'SEKJEN_KEUANGAN_1', 'SEKJEN_KEUANGAN_2', 'KEPALA_DEPARTEMEN', 'SEKRETARIS_DEPARTEMEN', 'KEPALA_BIRO', 'WAKIL_KEPALA_BIRO', 'ASISTEN_BIRO', 'STAFF');

-- CreateEnum
CREATE TYPE "KesekjenanCode" AS ENUM ('PENGEMBANGAN', 'RELASI', 'PERSONALIA');

-- CreateEnum
CREATE TYPE "DepartmentKind" AS ENUM ('DEPARTMENT', 'SPECIAL_BIRO');

-- CreateEnum
CREATE TYPE "ProkerType" AS ENUM ('PROYEK_BESAR', 'PROYEK_MENENGAH', 'AGENDA_BESAR', 'AGENDA_MENENGAH', 'PRODUK_PUBLIKASI', 'PRODUK_NON_PUBLIKASI');

-- CreateEnum
CREATE TYPE "ProkerStatus" AS ENUM ('PLANNED', 'ONGOING', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommitteeRole" AS ENUM ('KETUA_PELAKSANA', 'SEKBEN', 'KADIV', 'ANGGOTA');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "TaskSource" AS ENUM ('PROKER', 'MEETING');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PROPOSAL', 'LPJ');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'REVIEWED', 'APPROVED', 'AT_KAPRODI', 'SIGNED', 'ARCHIVED', 'REVISION');

-- CreateEnum
CREATE TYPE "FundingSource" AS ENUM ('PAGU_DEPARTEMEN', 'KAS_HMTC', 'MANDIRI');

-- CreateEnum
CREATE TYPE "DeadlineStep" AS ENUM ('KAPRODI_DISCUSSION', 'SUBMIT', 'PENGESAHAN', 'TO_KAPRODI', 'SPJ');

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('DRAFT', 'SIGNED', 'SPJ_RECEIPT');

-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('BPH', 'KESEKJENAN', 'KABINET', 'DEPARTEMEN', 'BIRO', 'PROKER');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'DONE');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'EXCUSED');

-- CreateEnum
CREATE TYPE "AttendanceMethod" AS ENUM ('QR', 'MANUAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nrp" TEXT,
    "avatarPath" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Period" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kesekjenan" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "code" "KesekjenanCode" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Kesekjenan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "kesekjenanId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "DepartmentKind" NOT NULL DEFAULT 'DEPARTMENT',

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Biro" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "Biro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "position" "Position" NOT NULL,
    "departmentId" TEXT,
    "biroId" TEXT,
    "coversKesekjenanId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proker" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "biroId" TEXT,
    "picMembershipId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" "ProkerType" NOT NULL,
    "status" "ProkerStatus" NOT NULL DEFAULT 'PLANNED',
    "eventDate" TIMESTAMP(3),
    "estimatedBudget" INTEGER NOT NULL DEFAULT 0,
    "cancelReason" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Proker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProkerCommitteeMember" (
    "id" TEXT NOT NULL,
    "prokerId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "role" "CommitteeRole" NOT NULL,
    "divisionName" TEXT,

    CONSTRAINT "ProkerCommitteeMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "prokerId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "doneById" TEXT,
    "note" TEXT,
    "evidenceUrl" TEXT,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "deadline" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "completedAt" TIMESTAMP(3),
    "source" "TaskSource" NOT NULL,
    "prokerId" TEXT,
    "meetingId" TEXT,
    "assigneeMembershipId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "prokerId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "totalBudget" INTEGER NOT NULL DEFAULT 0,
    "fundingSource" "FundingSource",
    "authorId" TEXT NOT NULL,
    "adminApprovedById" TEXT,
    "financeApprovedById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepDeadline" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "step" "DeadlineStep" NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "doneAt" TIMESTAMP(3),
    "late" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StepDeadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAttachment" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalLog" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "fromStatus" "DocumentStatus" NOT NULL,
    "toStatus" "DocumentStatus" NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "actorId" TEXT NOT NULL,
    "actorPosition" "Position",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "type" "MeetingType" NOT NULL,
    "title" TEXT NOT NULL,
    "agenda" JSONB NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "location" TEXT NOT NULL,
    "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "urgentReason" TEXT,
    "attendanceOpen" BOOLEAN NOT NULL DEFAULT false,
    "qrSecret" TEXT NOT NULL,
    "organizerMembershipId" TEXT NOT NULL,
    "kesekjenanId" TEXT,
    "departmentId" TEXT,
    "biroId" TEXT,
    "prokerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Minutes" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "decisions" JSONB NOT NULL,
    "carriedOver" JSONB NOT NULL,
    "filePath" TEXT,
    "publishedAt" TIMESTAMP(3),
    "late" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Minutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "optional" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "method" "AttendanceMethod" NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_nrp_key" ON "User"("nrp");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Period_name_key" ON "Period"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Kesekjenan_periodId_code_key" ON "Kesekjenan"("periodId", "code");

-- CreateIndex
CREATE INDEX "Department_kesekjenanId_idx" ON "Department"("kesekjenanId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_periodId_code_key" ON "Department"("periodId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Biro_departmentId_code_key" ON "Biro"("departmentId", "code");

-- CreateIndex
CREATE INDEX "Membership_periodId_idx" ON "Membership"("periodId");

-- CreateIndex
CREATE INDEX "Membership_departmentId_idx" ON "Membership"("departmentId");

-- CreateIndex
CREATE INDEX "Membership_biroId_idx" ON "Membership"("biroId");

-- CreateIndex
CREATE INDEX "Proker_departmentId_idx" ON "Proker"("departmentId");

-- CreateIndex
CREATE INDEX "Proker_status_idx" ON "Proker"("status");

-- CreateIndex
CREATE INDEX "Proker_eventDate_idx" ON "Proker"("eventDate");

-- CreateIndex
CREATE INDEX "Proker_createdAt_idx" ON "Proker"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProkerCommitteeMember_prokerId_membershipId_key" ON "ProkerCommitteeMember"("prokerId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItem_prokerId_key_key" ON "ChecklistItem"("prokerId", "key");

-- CreateIndex
CREATE INDEX "Task_prokerId_idx" ON "Task"("prokerId");

-- CreateIndex
CREATE INDEX "Task_assigneeMembershipId_idx" ON "Task"("assigneeMembershipId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_deadline_idx" ON "Task"("deadline");

-- CreateIndex
CREATE INDEX "Document_prokerId_idx" ON "Document"("prokerId");

-- CreateIndex
CREATE INDEX "Document_status_idx" ON "Document"("status");

-- CreateIndex
CREATE INDEX "Document_createdAt_idx" ON "Document"("createdAt");

-- CreateIndex
CREATE INDEX "StepDeadline_dueDate_doneAt_idx" ON "StepDeadline"("dueDate", "doneAt");

-- CreateIndex
CREATE UNIQUE INDEX "StepDeadline_documentId_step_key" ON "StepDeadline"("documentId", "step");

-- CreateIndex
CREATE UNIQUE INDEX "FileAttachment_path_key" ON "FileAttachment"("path");

-- CreateIndex
CREATE INDEX "FileAttachment_documentId_idx" ON "FileAttachment"("documentId");

-- CreateIndex
CREATE INDEX "ApprovalLog_documentId_createdAt_idx" ON "ApprovalLog"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "Meeting_periodId_startsAt_idx" ON "Meeting"("periodId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Minutes_meetingId_key" ON "Minutes"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_meetingId_membershipId_key" ON "Invitation"("meetingId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_meetingId_membershipId_key" ON "Attendance"("meetingId", "membershipId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kesekjenan" ADD CONSTRAINT "Kesekjenan_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_kesekjenanId_fkey" FOREIGN KEY ("kesekjenanId") REFERENCES "Kesekjenan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Biro" ADD CONSTRAINT "Biro_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_biroId_fkey" FOREIGN KEY ("biroId") REFERENCES "Biro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_coversKesekjenanId_fkey" FOREIGN KEY ("coversKesekjenanId") REFERENCES "Kesekjenan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proker" ADD CONSTRAINT "Proker_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proker" ADD CONSTRAINT "Proker_biroId_fkey" FOREIGN KEY ("biroId") REFERENCES "Biro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proker" ADD CONSTRAINT "Proker_picMembershipId_fkey" FOREIGN KEY ("picMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proker" ADD CONSTRAINT "Proker_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proker" ADD CONSTRAINT "Proker_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProkerCommitteeMember" ADD CONSTRAINT "ProkerCommitteeMember_prokerId_fkey" FOREIGN KEY ("prokerId") REFERENCES "Proker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProkerCommitteeMember" ADD CONSTRAINT "ProkerCommitteeMember_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_prokerId_fkey" FOREIGN KEY ("prokerId") REFERENCES "Proker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_doneById_fkey" FOREIGN KEY ("doneById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_prokerId_fkey" FOREIGN KEY ("prokerId") REFERENCES "Proker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeMembershipId_fkey" FOREIGN KEY ("assigneeMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_prokerId_fkey" FOREIGN KEY ("prokerId") REFERENCES "Proker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_adminApprovedById_fkey" FOREIGN KEY ("adminApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_financeApprovedById_fkey" FOREIGN KEY ("financeApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepDeadline" ADD CONSTRAINT "StepDeadline_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAttachment" ADD CONSTRAINT "FileAttachment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAttachment" ADD CONSTRAINT "FileAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalLog" ADD CONSTRAINT "ApprovalLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalLog" ADD CONSTRAINT "ApprovalLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "Period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_organizerMembershipId_fkey" FOREIGN KEY ("organizerMembershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_kesekjenanId_fkey" FOREIGN KEY ("kesekjenanId") REFERENCES "Kesekjenan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_biroId_fkey" FOREIGN KEY ("biroId") REFERENCES "Biro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_prokerId_fkey" FOREIGN KEY ("prokerId") REFERENCES "Proker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Minutes" ADD CONSTRAINT "Minutes_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Minutes" ADD CONSTRAINT "Minutes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial unique indexes. Prisma's schema language cannot express them, so they live only here.
-- Exactly one active period.
CREATE UNIQUE INDEX "Period_single_active_key" ON "Period"("isActive") WHERE "isActive";
-- One active (not ended) membership per user per period.
CREATE UNIQUE INDEX "Membership_active_user_period_key" ON "Membership"("userId", "periodId") WHERE "endedAt" IS NULL;
-- One live (not soft-deleted) proposal and one live LPJ per proker.
CREATE UNIQUE INDEX "Document_live_proker_type_key" ON "Document"("prokerId", "type") WHERE "deletedAt" IS NULL;

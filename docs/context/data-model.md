# Data model

Source of truth is `apps/api/prisma/schema.prisma`; this file explains intent and invariants.
Keep both in sync (the `context-sync` skill checks this).

Structure: **Period → Kesekjenan → Department (or special biro) → Biro**. The centre is **Membership**:
one position per user per period, attached to the right unit level.

| Entity | Key fields | Relations |
| --- | --- | --- |
| User | email (unique), passwordHash, name, nrp, avatarPath, isAdmin, deactivatedAt? | has many Membership, RefreshToken |
| RefreshToken | tokenHash, familyId, expiresAt, revokedAt | belongs to User |
| Period | name (unique), startDate, endDate, isActive | has many Kesekjenan, Membership |
| Kesekjenan | code: PENGEMBANGAN, RELASI, PERSONALIA; name | belongs to Period; has many Department |
| Department | name, code (unique per period), kind: DEPARTMENT, SPECIAL_BIRO | belongs to Kesekjenan; has many Biro, Proker |
| Biro | name, code (unique per department) | belongs to Department (kind DEPARTMENT) |
| Membership | position, departmentId?, biroId?, coversKesekjenanId?, endedAt? | User × Period |
| Proker | name, description, type, status, eventDate?, estimatedBudget, cancelReason?, deletedAt | belongs to Department; executing Biro?; PIC Membership |
| ProkerCommitteeMember | role: KETUA_PELAKSANA, SEKBEN, KADIV, ANGGOTA; divisionName? | Proker × Membership (unique pair) |
| ProkerEvaluation (Should) | wentWell, toImprove, problems, recommendations, feedbackUrl, filledById | one per Proker |
| ChecklistItem | key, label, dueDate?, doneAt?, doneById?, note?, evidenceUrl? | belongs to Proker; generated from the type template |
| Task | title, description, deadline, status, completedAt?, source: PROKER, MEETING | Proker? (required when source = PROKER), Meeting?; assignee Membership |
| Document | type: PROPOSAL, LPJ; title, status, version, totalBudget, fundingSource, adminApprovedById?, financeApprovedById?, authorId, deletedAt | belongs to Proker; has many FileAttachment, ApprovalLog, StepDeadline |
| StepDeadline | step: KAPRODI_DISCUSSION, SUBMIT, PENGESAHAN, TO_KAPRODI, SPJ; dueDate, doneAt?, late | belongs to Document |
| FileAttachment | path, mimeType, size, originalName, version, kind: DRAFT, SIGNED, SPJ_RECEIPT | belongs to Document |
| ApprovalLog | fromStatus, toStatus, action, note, actorId, actorPosition, createdAt | belongs to Document |
| Meeting | type, title, agenda (JSON: topics, expected outputs, materials), startsAt, durationMin, location, status, urgent, urgentReason?, attendanceOpen, qrSecret | organizer Membership; scope unit ids; Proker? |
| Minutes | summary, decisions (JSON), carriedOver (JSON), filePath?, publishedAt, late | one per Meeting |
| Invitation | optional (bool) | Membership × Meeting |
| Attendance | status: PRESENT, EXCUSED; method: QR, MANUAL; checkedInAt; note | Membership × Meeting |
| RabLine (Should) | category, description, quantity, unitPrice | belongs to Document (PROPOSAL) |
| SpjItem (Should) | category, description, amount, receiptPath, status, verifiedById? | belongs to Document (LPJ) |
| AuditLog (Could) | entity, entityId, action, before, after, actorId | — |

## Enums
- `Position`: KETUA, SEKJEN_PENGEMBANGAN, SEKJEN_RELASI, SEKJEN_PERSONALIA, SEKJEN_ADMINISTRASI_1,
  SEKJEN_ADMINISTRASI_2, SEKJEN_KEUANGAN_1, SEKJEN_KEUANGAN_2, KEPALA_DEPARTEMEN, SEKRETARIS_DEPARTEMEN,
  KEPALA_BIRO, WAKIL_KEPALA_BIRO, ASISTEN_BIRO, STAFF. (Intern staff = STAFF.)
- Role groups (derived in code, never stored): KETUA, SEKJEN_BIDANG, SEKJEN_ADM, SEKJEN_KEU, DEPT_LEAD,
  BIRO_LEAD, STAFF (STAFF + ASISTEN_BIRO). PIC is a per-proker relation, not a position.
- `ProkerType`: PROYEK_BESAR, PROYEK_MENENGAH, AGENDA_BESAR, AGENDA_MENENGAH, PRODUK_PUBLIKASI, PRODUK_NON_PUBLIKASI.
- `ProkerStatus`: PLANNED, ONGOING, DONE, CANCELLED. `TaskStatus`: TODO, IN_PROGRESS, DONE.
- `DocumentStatus`: DRAFT, IN_REVIEW, REVIEWED, APPROVED, AT_KAPRODI, SIGNED, ARCHIVED, REVISION.
- `FundingSource`: PAGU_DEPARTEMEN, KAS_HMTC, MANDIRI.
- `MeetingType`: BPH, KESEKJENAN, KABINET, DEPARTEMEN, BIRO, PROKER. `MeetingStatus`: SCHEDULED, CANCELLED, DONE.

## Invariants
- Exactly one active Period. Kesekjenan codes unique per period.
- Membership unit by position: KETUA, SEKJEN_* → no department/biro; SEKJEN_ADMINISTRASI_*, SEKJEN_KEUANGAN_*
  → `coversKesekjenanId` required (RELASI or PENGEMBANGAN kesekjenan); KADEP/SEKDEP → department (kind DEPARTMENT);
  KABIRO/WAKABIRO/STAFF → biro; ASISTEN_BIRO → department of kind SPECIAL_BIRO.
- One active membership per user per period (partial unique index where `endedAt IS NULL`); single-seat
  positions unique per period / department / biro; one Sekjen Adm and one Sekjen Keu per covered kesekjenan.
- Proker: executing biro belongs to the proker's department; PIC is a member of the department.
- One non-deleted PROPOSAL and one non-deleted LPJ per proker. An LPJ can be drafted any time but submitted only after `eventDate`.
- Committee members belong to the proker's department; the PIC is always the KETUA_PELAKSANA. PROYEK_BESAR needs a
  Sekben and at least one KADIV before its proposal is submitted.
- A deactivated user cannot log in and has no active membership.
- A document reaches REVIEWED only when both `adminApprovedById` and `financeApprovedById` are set; any
  return to REVISION clears both.
- Money is stored as integer rupiah (no floats).
- `Attendance` unique on (membershipId, meetingId). `Minutes` unique per meeting.
- Reuse of a revoked refresh token revokes its whole family.
- Soft-deleted Proker/Document are excluded from lists and search by default.

## Indexes
`status`, `departmentId`, `periodId`, `eventDate`, `createdAt` on list tables; StepDeadline(`dueDate`, `doneAt`)
for the tracker; Postgres full-text search on Proker.name, Proker.description and Document.title.

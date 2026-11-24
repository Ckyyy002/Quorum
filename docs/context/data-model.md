# Data model

Source of truth is `apps/api/prisma/schema.prisma`; this file explains the intent and invariants.
Keep both in sync (the `context-sync` skill checks this).

The centre is **Membership**: a user can hold different positions in different departments across periods,
so history is preserved and permissions are always checked against the active period.

| Entity | Key fields | Relations |
| --- | --- | --- |
| User | email (unique), passwordHash, name, nrp, isAdmin | has many Membership, RefreshToken |
| RefreshToken | tokenHash, familyId, expiresAt, revokedAt | belongs to User |
| Period | name (e.g. 2026/2027), startDate, endDate, isActive | has many Department, Membership |
| Department | name, code | belongs to Period; has many Proker |
| Membership | position: KETUA, SEKRETARIS, BENDAHARA, KADEP, STAF | User × Period × Department (null for BPH) |
| Proker | title, description, status, startDate, endDate, deletedAt | belongs to Department; has many Task, Document, Meeting |
| Task | title, deadline, status: TODO, IN_PROGRESS, DONE, position | belongs to Proker; assignee Membership |
| Document | title, type: PROPOSAL, LPJ, NOTULENSI, status, version, deletedAt | belongs to Proker; has many FileAttachment, ApprovalLog |
| FileAttachment | path, mimeType, size, originalName | belongs to Document or User (avatar) |
| ApprovalLog | fromStatus, toStatus, note, actorId, createdAt | belongs to Document |
| Meeting | title, startsAt, location, qrSecret, qrExpiresAt | belongs to Proker (optional = org-wide); has many Attendance |
| Attendance | checkedInAt, method: QR, MANUAL | Membership × Meeting |
| AuditLog (Could) | entity, entityId, action, before, after, actorId | — |

## Invariants
- Exactly one `Period` has `isActive = true`.
- `Membership` unique on (userId, periodId, departmentId).
- `Attendance` unique on (membershipId, meetingId) — duplicate check-in rejected by the DB.
- Only one active refresh-token family per login; reuse of a revoked token revokes the whole family.
- Soft-deleted Proker/Document are excluded from lists and search by default.

## Indexes
`status`, `departmentId`, `periodId`, `createdAt` on list tables; Postgres full-text search on
Document.title and Proker.title.

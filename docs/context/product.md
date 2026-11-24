# Product

Quorum runs one student-organization management period end to end: work programs, tasks, documents that
need approval, meetings and attendance, with an auditable trail of decisions.

## Roles
| Role | Scope | Typical rights |
| --- | --- | --- |
| Admin (system) | Whole system | Create periods and departments, assign BPH |
| BPH (Ketua, Sekretaris, Bendahara) | Whole organization in the active period | Final document approval, view all proker, dashboards, schedule org-wide meetings |
| Kadep (head of department) | Own department in the active period | Create/edit proker, assign tasks, first-level document review |
| Staf | Own tasks and proker they belong to | Update own tasks, upload documents, attend meetings |

A user's role is derived from `Membership` (user × period × department × position), not stored on `User`.
Only `User.isAdmin` is global.

## Permission matrix (active period)
| Action | Admin | BPH | Kadep | Staf |
| --- | --- | --- | --- | --- |
| Manage periods/departments/memberships | ✓ | – | – | – |
| Create/edit/delete proker | – | ✓ any | ✓ own dept | – |
| View proker | ✓ | ✓ | ✓ | ✓ |
| Create/assign tasks | – | ✓ | ✓ own dept | – |
| Update task status | – | ✓ | ✓ own dept | ✓ own tasks |
| Upload/edit draft document | – | ✓ | ✓ own dept | ✓ own dept |
| Submit document | – | ✓ | ✓ own dept | ✓ author |
| Review (Submitted → Reviewed / Revision) | – | – | ✓ own dept | – |
| Approve (Reviewed → Approved / Revision) | – | ✓ | – | – |
| Archive approved document | – | ✓ | – | – |
| Schedule meeting | – | ✓ any | ✓ own dept | – |
| Open/refresh attendance QR | – | ✓ | ✓ organizer | – |
| Check in via QR | – | ✓ | ✓ | ✓ invited |

## User stories
| ID | Story | Priority | FP requirement |
| --- | --- | --- | --- |
| US-1 | As a user, I can register, log in and stay logged in via refresh token | Must | JWT, hashing, validation |
| US-2 | As Admin, I can create periods and departments and assign members with positions | Must | CRUD, RBAC |
| US-3 | As Kadep, I can create and manage my department's proker | Must | CRUD, contextual authorization |
| US-4 | As Kadep, I can assign tasks to staff; staff update their task status | Must | CRUD, ownership |
| US-5 | As a member, I can upload a proposal/LPJ that moves Draft → Submitted → Reviewed → Approved → Archived (with Revision) | Must | File upload, state machine |
| US-6 | As Sekretaris/Kadep, I can schedule a meeting; invitees receive an email | Must | Email |
| US-7 | As an invitee, I can check in with a QR code that expires after a few minutes | Must | Business logic, token rules |
| US-8 | As a user, I can search proker, documents and archives with filters (department, status, period, date) and pagination | Must | Search, filter, pagination |
| US-9 | As BPH, I see a dashboard: proker progress, pending documents, attendance rate | Should | Aggregation |
| US-10 | As a member, I get an email reminder one day before a task deadline and a weekly summary | Should | Scheduled email |
| US-11 | As Kadep, I see the task board update in real time | Could | WebSocket |
| US-12 | As BPH, I can view an audit log of who changed what | Could | Audit trail |

## Out of scope
Finance/treasury, internal chat, native mobile app.

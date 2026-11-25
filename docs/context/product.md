# Product

Quorum runs one management period of a student organization end to end, modelled on HMTC ITS's
"Buku Biru Kabinet Niat Baik 2026/2027": kesekjenan, departments and biros, work programs (proker) with
type-based checklists, a proposal/LPJ approval flow with deadlines relative to the event date, meetings
with agenda/minutes rules and QR attendance, and email notifications.

## Organization structure
```
Period (e.g. 2026/2027)
├── BPH: Ketua Himpunan + 7 Sekjen
│     Sekjen Pengembangan, Sekjen Relasi, Sekjen Personalia   (oversee a kesekjenan)
│     Sekjen Administrasi 1 & 2, Sekjen Keuangan 1 & 2        (review documents; each covers one kesekjenan)
├── Kesekjenan Pengembangan → Departments SRD, SW, RT, STI, EDD
├── Kesekjenan Relasi       → Departments IA, EA, SSD, CMI
└── Kesekjenan Personalia   → Biro Personalia (special unit: Sekjen Personalia + Asisten Biro, no Kadep)

Department: Kadep, Sekdep
└── Biro: Kabiro, Wakabiro ("Kawakabiro")
    └── Staff (intern staff are treated as Staff)
Proker: owned by a department, executed by one biro, led by a PIC / Ketua Pelaksana, with a committee
(Sekben, Kepala Divisi, Anggota) drawn from the department.
```
Department names above are seed data for HMTC; Admin can create any structure.

## Roles
A user's role comes from their `Membership` in the active period, never from `User`. Only `User.isAdmin`
is global. Numbered and deputy positions share their group's rights.

| Role group | Positions | Scope | Summary |
| --- | --- | --- | --- |
| Admin | `User.isAdmin` | system | Sets up periods, kesekjenan, departments, biros, memberships |
| Ketua | KETUA | everything | Oversees all, final internal approval (pengesahan) of proposals/LPJ |
| Sekjen Bidang | SEKJEN_PENGEMBANGAN, SEKJEN_RELASI, SEKJEN_PERSONALIA | own kesekjenan | Monitors departments under the kesekjenan, may attend their meetings; Sekjen Personalia leads Biro Personalia |
| Sekjen Administrasi | SEKJEN_ADMINISTRASI_1, _2 | assigned kesekjenan | Administrative review of proposals/LPJ, archives |
| Sekjen Keuangan | SEKJEN_KEUANGAN_1, _2 | assigned kesekjenan | Financial review (RAB) of proposals/LPJ, SPJ verification |
| Dept lead | KEPALA_DEPARTEMEN, SEKRETARIS_DEPARTEMEN | own department | Plans proker, assigns biro and PIC, drafts/submits proposals and LPJ, department meetings, archives department documents |
| Biro lead | KEPALA_BIRO, WAKIL_KEPALA_BIRO | own biro | Technical lead of proker executed by the biro, manages its tasks, biro meetings |
| Staff | STAFF, ASISTEN_BIRO | own biro | Works on tasks; can be appointed PIC of a proker |
| PIC (per proker) | any member appointed on a proker | that proker | Ketua Pelaksana / PJ Kegiatan: manages the proker's tasks and checklist, co-drafts its documents |
| Guest | logged in, no membership in the active period, not verified | — | Own profile, public proker summary, request Mahasiswa TC verification |
| Mahasiswa TC | verified by Admin (or any active functionary) | public services | Uses department services: aspirations, competitions, communities, merch, events, programs, donations |

Review coverage: each Sekjen Administrasi and Sekjen Keuangan membership has `coversKesekjenan`
(RELASI or PENGEMBANGAN). Documents of a department are reviewed by the Sekjen Adm and Sekjen Keu who cover
its kesekjenan. Biro Personalia documents can be reviewed by either holder (assumption, see progress.md).

## Proker types (Buku Biru BAB IV)
| Type | Lead | Key rules turned into checklist items (H = event date) |
| --- | --- | --- |
| PROYEK_BESAR | Ketua Pelaksana + Sekben + Kadiv | WBS; ≥ 2 presentations to BPH; proposal draft ≤ H-21; volunteer recruitment ≤ H-30; briefing; publicity H-7/H-3/H-1/H; ≥ 2 BPH + 2 dept leaders on the day; evaluation ≤ H+3 (offline); certificates ≤ H+30 |
| PROYEK_MENENGAH | Ketua Pelaksana | WBS; ≥ 1 presentation to BPH; proposal ≤ H-21 if it needs budget; publicity H-7/H-3/H-1/H; ≥ 1 BPH + 1 dept leader; evaluation on H; certificates ≤ H+30 |
| AGENDA_BESAR | PIC staff | WBS; ≥ 1 briefing with dept leaders and BPH; proposal ≤ H-21 if budget; publicity H-7/H-3/H-1/H; ≥ 2 BPH + 2 dept leaders; evaluation ≤ H+3 |
| AGENDA_MENENGAH | PIC staff | publicity H-2/H-1/H; evaluation async after H |
| PRODUK_PUBLIKASI | PIC staff | content draft; material review by Kawakabiro; design review / CMI request; post-publication engagement review |
| PRODUK_NON_PUBLIKASI | PIC staff | output defined; evaluation after delivery |
Checklist templates live in code (`proker/domain/checklist-templates.ts`) and are generated when the
event date is set; items have due dates and are confirmed by ticking only (no evidence link required),
by the PIC and leaders.

## Document workflow (Buku Biru BAB VII)
PROPOSAL and LPJ:
```
DRAFT ──submit (Dept lead)──▶ IN_REVIEW ──(Sekjen Adm ✓ AND Sekjen Keu ✓)──▶ REVIEWED
      ──pengesahan (Ketua)──▶ APPROVED ──sent to Kaprodi (Dept lead)──▶ AT_KAPRODI
      ──signed PDF uploaded (Dept lead)──▶ SIGNED ──archive (Dept lead / Sekjen Adm)──▶ ARCHIVED
Either reviewer or Ketua can return it ──▶ REVISION (note required) ──▶ DRAFT
```
Deadlines for proposals (relative to the proker's event date H): Kaprodi discussion ≤ H-21, submit to Sekjen
≤ H-18, Ketua ≤ H-15, to Kaprodi ≤ H-14. Late steps are allowed but flagged `late`.
LPJ is required for every proker (with or without funds) and follows the same flow. Its draft can be written
before the event ends; it can be submitted only after the event date.
SPJ (expense evidence, ≤ H+5, verified by Sekjen Keuangan) is a Should.
NOTULENSI (minutes) does not use this flow (see meetings).

## Meetings (Buku Biru BAB V)
| Type | Organizer | Default invitees |
| --- | --- | --- |
| BPH | any BPH | Ketua + all Sekjen |
| KESEKJENAN | Sekjen Bidang | that Sekjen + all elements of its departments |
| KABINET | any BPH | BPH + every Kadep and Sekdep |
| DEPARTEMEN | Dept lead | all elements of the department; the kesekjenan's Sekjen Bidang may join (visit) |
| BIRO | Biro lead | the biro |
| PROKER | PIC or Dept lead | the proker committee (Ketua Pelaksana, Sekben, Kadiv, Anggota) |
Rules: the agenda (topics, expected outputs, materials) must go out ≥ 24 h before the start (urgent
meetings need a reason); minutes are due ≤ 24 h after the end and contain decisions, next actions (PIC +
deadline) and carried-over items; next actions become tasks automatically.

## Permission matrix (active period)
Legend: ✓ all · K = own kesekjenan · C = covered kesekjenan · D = own department · B = own biro (proker executed by it) · P = proker where I am PIC · own = own items · – = no

| Action | Admin | Ketua | Sekjen Bidang | Sekjen Adm | Sekjen Keu | Dept lead | Biro lead | PIC | Staff | Guest |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Manage structure and memberships | ✓ | – | – | – | – | – | – | – | – | – |
| Edit own profile | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View proker summary | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View proker detail | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – |
| Create / delete proker, set biro and PIC | – | – | – | – | – | D | – | – | – | – |
| Edit proker details, event date, type | – | ✓ | – | – | – | D | B | P | – | – |
| Change proker status | – | – | – | – | – | D | B | P | – | – |
| Tick checklist items | – | – | – | – | – | D | B | P | – | – |
| Set committee structure | – | – | – | – | – | D | – | P | – | – |
| Fill post-event evaluation (Should) | – | – | – | – | – | D | B | P | – | – |
| Create / assign tasks | – | – | – | – | – | D | B | P | – | – |
| Update task status | – | – | – | – | – | D | B | P | own | – |
| Draft proposal / LPJ, upload versions | – | – | – | – | – | D | B | P | – | – |
| Submit to review | – | – | – | – | – | D | – | – | – | – |
| Administrative review | – | – | – | C | – | – | – | – | – | – |
| Financial review | – | – | – | – | C | – | – | – | – | – |
| Pengesahan (final internal approval) | – | ✓ | – | – | – | – | – | – | – | – |
| Mark sent to Kaprodi, upload signed PDF | – | – | – | – | – | D | – | – | – | – |
| Archive document | – | – | – | C | – | D | – | – | – | – |
| Upload / verify SPJ (Should) | – | – | – | – | verify C | upload D | upload B | upload P | – | – |
| Schedule meeting (by type) | – | BPH, KABINET | KESEKJENAN | BPH, KABINET | BPH, KABINET | DEPARTEMEN, PROKER | BIRO | PROKER | – | – |
| Publish minutes, manage attendance | – | organizer | organizer | organizer | organizer | organizer | organizer | organizer | – | – |
| Check in to a meeting | – | invited | invited | invited | invited | invited | invited | invited | invited | – |
| Organization dashboard (Should) | ✓ | ✓ | K | C | C | – | – | – | – | – |
| Cabinet calendar (Should): proker events / all meetings | ✓ | all | proker | all | proker | proker | proker | proker | proker | – |
| Deactivate a user account (Could) | ✓ | – | – | – | – | – | – | – | – | – |

Document visibility: SIGNED/ARCHIVED documents are visible to all members; earlier stages only to the
proker's department and biro, the PIC, the covering Sekjen Adm/Keu, the kesekjenan's Sekjen Bidang and Ketua.
Nobody reviews or approves a document they authored.

## Epics
Detailed per-role stories with acceptance criteria: `docs/context/user-stories.md` (IDs `US-<epic>.<n>`).

| ID | Epic | Priority | FP requirement |
| --- | --- | --- | --- |
| US-1 | Auth and profile | Must | JWT, hashing, validation, file upload |
| US-2 | Organization structure (period, kesekjenan, department, biro, memberships) | Must | CRUD, RBAC |
| US-3 | Proker: ownership, PIC, types and checklists | Must | CRUD, contextual authorization, business rules |
| US-4 | Tasks | Must | CRUD, ownership |
| US-5 | Proposal and LPJ approval flow with deadlines | Must | File upload, state machine |
| US-6 | Meetings, agenda/minutes rules, next actions | Must | Email |
| US-7 | QR attendance | Must | Business logic, token rules |
| US-8 | Search, filter, pagination, document tracker | Must | Search & filtering |
| US-9 | Dashboards | Should | Aggregation |
| US-10 | Scheduled reminders | Should | Scheduled email |
| US-11 | Real-time task board | Could | WebSocket |
| US-12 | Audit log | Could | Audit trail |
| US-13 | SPJ (expense evidence) and RAB line items | Should | File upload, calculations |
| US-14 … US-24 | Department services + Mahasiswa TC role (see `department-stories.md`) | Should | Extra complexity / innovation |

## Out of scope
Cash ledger and reimbursement payments, payment gateways, internal chat, native mobile app,
integration with Microsoft Teams/OneDrive (the Kaprodi steps are tracked manually in Quorum).

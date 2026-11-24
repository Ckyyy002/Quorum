# User stories (detailed)

Grouped by role, derived from the job descriptions in Buku Biru HMTC Kabinet Niat Baik 2026/2027.
IDs are `US-<epic>.<n>`; the epic number matches the GitHub issue and `product.md`. The same stories live in
the SPS Backlog Google Sheet as `QRM-<epic, 2 digits>-<n, 2 digits>` (US-5.3 = QRM-05-03). Acceptance criteria (AC)
are the contract the `story` skill builds and tests against; every status code mentioned needs an e2e test.

Priority: **Must** = required for the FP submission · **Should** = only if the sprint finishes early ·
**Could** = portfolio extras after submission.

Role names follow `product.md`: Admin, Ketua, Sekjen Bidang (Pengembangan/Relasi/Personalia), Sekjen Adm,
Sekjen Keu, Dept lead (Kadep/Sekdep), Biro lead (Kabiro/Wakabiro), PIC (per proker), Staff, Guest.

## Global rules (apply to every story)
- G1. Every endpoint except register, login, refresh and forgot/reset password needs a valid access token → otherwise **401**.
- G2. Logged in but not allowed (position, scope, ownership, wrong period) → **403**. Not found or soft-deleted → **404**.
- G3. Invalid body/query → **400** with field-level messages.
- G4. Lists: `?page` (default 1), `?limit` (default 10, max 50), `?sort=field:asc|desc`; response `{ data, meta }`.
- G5. Rights apply to the **active period** only; past periods are read-only.
- G6. Creates/updates store `createdBy`/`updatedBy`; Proker and Document deletes are soft deletes.
- G7. Emails go out asynchronously through events; an email failure never fails the HTTP request.
- G8. Scope checks: Biro lead → proker executed by their biro; Dept lead → their department; Sekjen Bidang →
  departments of their kesekjenan; Sekjen Adm/Keu → departments of the kesekjenan they cover; Ketua → all.
- G9. Nobody reviews or approves a document they authored → **403**.
- G10. Dates are stored in UTC and shown in WIB (Asia/Jakarta); "H-n" means n calendar days before the proker's event date.

---

## Guest (logged in, no membership in the active period)

### US-1.1 Register — Must
- AC1. Fields: name (2–100), email, password, NRP (optional, 10 digits) → **201**, user without passwordHash.
- AC2. Password ≥ 8 chars with upper, lower and digit → otherwise **400** naming the rule.
- AC3. Email unique (case-insensitive) → **409**. Password hashed with argon2, never returned or logged.
- AC4. A new user is a Guest until Admin assigns a membership.

### US-1.2 Login — Must
- AC1. Correct credentials → **200**, access token (15 min) in body, refresh token (7 days) in an httpOnly, Secure, SameSite=Strict cookie.
- AC2. Wrong email or password → **401** with one generic message.
- AC3. More than 5 failed attempts per minute per IP → **429** (Should).

### US-1.6 Forgot and reset password — Should
- AC1. Request always → **202**; single-use link valid 30 min, token stored hashed; valid reset → **200** and all refresh tokens revoked; expired/used → **400**.

### US-3.8 Public proker summary — Must
- AC1. Guest sees the active period's proker list: name, department, biro, type, event date, status. No tasks, documents or members.
- AC2. Guest calling a proker detail, task or document endpoint → **403**.

---

## Every member (any position)

### US-1.3 Stay logged in — Must
- AC1. `POST /auth/refresh` with a valid cookie → **200**, new access token, refresh token rotated.
- AC2. Reusing a rotated refresh token → **401** and the whole token family is revoked.
- AC3. Web: Axios interceptor refreshes once on 401 and retries; on failure redirects to login.

### US-1.4 Logout — Must
- AC1. `POST /auth/logout` revokes the current refresh token and clears the cookie → **204**.

### US-1.5 Profile and avatar — Must
- AC1. Edit name and NRP → **200**; email cannot be changed.
- AC2. Avatar JPG/PNG/WebP ≤ 2 MB, magic bytes checked → **400** / **413**; replaces the old file.

### US-2.6 My position and navigation — Must
- AC1. `GET /me` returns profile + active membership: position, role group, kesekjenan, department, biro, covered kesekjenan (Sekjen Adm/Keu), and proker where I am PIC.
- AC2. Web menus follow it; the API still enforces every rule (G2).

### US-4.5 My tasks — Must
- AC1. `GET /me/tasks` filters: status, proker, source (proker task / meeting next action), deadline range; nearest deadline first.
- AC2. Overdue (deadline passed, not DONE) → `isOverdue: true`.

### US-6.8 My meetings — Must
- AC1. `GET /me/meetings?range=upcoming|past` with type, agenda, my attendance status, and minutes link when published.

### US-7.1 Check in with QR — Must
- AC1. Valid, unexpired token for a meeting I am invited to → **201**, method QR.
- AC2. Expired or tampered token → **400**; not invited → **403**; second check-in → **409** (DB unique).
- AC3. Allowed from 30 min before start until the organizer closes attendance → otherwise **400**.

### US-8.1 Search proker — Must
- AC1. `GET /proker?q=` full-text on name and description.
- AC2. Filters: kesekjenan, department, biro, type, status, event-date range, period (default active); combined with AND.
- AC3. Unknown filter values → **400**.

### US-8.2 Search documents — Must
- AC1. `GET /documents?q=` on title; filters: type, status, kesekjenan, department, proker, `late=true`, date range.
- AC2. Visibility per `product.md` (SIGNED/ARCHIVED for all; earlier stages only for the people involved).

### US-8.3 Archives of past periods — Should
- AC1. Choosing a past period shows its proker and ARCHIVED documents read-only (G5).

---

## Staff (including intern staff and Asisten Biro)

### US-4.3 Update my task — Must
*Buku Biru: staff are accountable to Kawakabiro for executing proker work.*
- AC1. Assignee (or PIC / Biro lead / Dept lead in scope) changes status TODO → IN_PROGRESS → DONE, and DONE → IN_PROGRESS.
- AC2. Others → **403**; skipping a step → **400**. DONE stores `completedAt`.

### US-4.6 Comment and attach on a task — Could
- AC1. Assignee and leaders in scope comment and attach one file (≤ 5 MB) per comment.

---

## PIC / Ketua Pelaksana (per proker; usually Staff)
*Buku Biru: the Ketua Pelaksana/PIC manages risk, people and non-technical work, escalates blockers, and
the PJ Kegiatan drafts the proposal with the Sekdep.*

### US-3.4 Run the proker checklist — Must
- AC1. When the proker has a type and an event date, its checklist is generated from the type's template with due dates (see `product.md` → Proker types); changing the event date recalculates open items.
- AC2. PIC and leaders in scope tick items (with optional note and evidence link); ticking is idempotent.
- AC3. Items past due and not ticked are flagged `overdue`; the proker shows `n/m done` and the next due item.
- AC4. Others ticking → **403**.
- AC5. Every item is confirmed by ticking only, including presentations to BPH; no link to a recorded meeting is required.

### US-3.9 Committee structure — Must
- AC1. PIC (or Dept lead) sets the committee: Ketua Pelaksana (= PIC), Sekben, Kepala Divisi with a division name, and Anggota.
- AC2. PROYEK_BESAR requires a Ketua Pelaksana, a Sekben and at least one Kepala Divisi before its proposal can be submitted → **409**; other types need only the PIC.
- AC3. Committee members must be active members of the proker's department → **400**; volunteers are outside the app.
- AC4. The committee is the default invitee list of PROKER meetings; added members are emailed.

### US-3.10 Post-event evaluation — Should
- AC1. After the event date, PIC, the executing biro's leads or Dept leads fill the evaluation: went well, to improve, problems and solutions, recommendations for the next cabinet, feedback-form link.
- AC2. Saving it ticks the checklist's evaluation item; due date follows the proker type (e.g. H+3 for PROYEK_BESAR).
- AC3. Before the event date → **409**. Evaluations of past periods are readable by members of later periods.

### US-4.1 Create and assign tasks — Must
*Also available to Biro lead and Dept lead in scope.*
- AC1. Fields: title, description, deadline (not in the past), assignee (member of the proker's department) → **201**.
- AC2. Assignee outside the department → **400**; proker outside my scope → **403**.
- AC3. `TaskAssigned` → email to the assignee.

### US-4.2 Edit, reassign and delete tasks — Must
- AC1. Same people as US-4.1 edit, reassign (new assignee is emailed) and delete tasks of the proker.

### US-4.4 Task board — Must
- AC1. Board per proker: TODO / IN_PROGRESS / DONE; drag-and-drop uses the US-4.3 rules; filter by assignee; overdue badge.

### US-5.1 Draft a proposal or LPJ — Must
*Shared with Dept lead and Biro lead in scope.*
- AC1. Fields: type (PROPOSAL or LPJ), title, proker, total budget (integer rupiah ≥ 0; requested for PROPOSAL, realized for LPJ), funding source (PAGU_DEPARTEMEN, KAS_HMTC, MANDIRI), file (PDF/DOCX ≤ 10 MB, magic bytes checked → **400** / **413**).
- AC2. Only for a proker in my scope → **403**. One active PROPOSAL and one active LPJ per proker → **409**.
- AC3. An LPJ draft can be created and edited at any time, including before the event ends (Buku Biru 7.1.4 point 11).
- AC4. Starts as DRAFT, version 1; each new upload increments `version` and keeps old files.

### US-5.7 Revise a returned document — Must
- AC1. In REVISION, drafters in scope edit fields and upload a new version; the reviewer notes stay visible.
- AC2. Re-submission restarts review: both Sekjen Adm and Sekjen Keu must approve again.

### US-5.8 Document history and deadlines — Must
- AC1. Shows every version (downloadable), the ApprovalLog timeline (from → to, actor, position, note, time) and each deadline (H-18, H-15, H-14) with done/late/pending.

### US-6.6 Schedule a proker meeting — Must
- AC1. Type PROKER, invitees default to the proker committee (US-3.9); Dept lead can also schedule it.

---

## Biro lead (Kepala Biro, Wakil Kepala Biro)
*Buku Biru: technical mentor and quality owner of the biro's proker; gives technical input to Kadep/Sekdep;
prepares the biro's progress before department meetings.*

### US-3.3 Edit the proker my biro executes — Must
- AC1. Biro leads edit description, event date and type of proker executed by their biro → **200**; they cannot delete it or change its department → **403**.

### US-3.5 Biro progress overview — Must
- AC1. List of proker executed by my biro with checklist progress, open/overdue tasks and document stage — the input for the monthly department meeting.

### US-6.1 Schedule a biro meeting — Must
- AC1. Type BIRO; fields: title, agenda (topics, expected outputs, materials), start (future), duration, location or link; invitees default to the biro.
- AC2. Agenda rule (all meeting types): start < 24 h from now → **400** unless `urgent: true` with a reason (≥ 10 chars); `MeetingScheduled` → invitation email with the agenda.

### US-6.2 Reschedule or cancel a meeting — Must
- AC1. Organizer changes time/place → update email; cancel → cancellation email; meeting kept as CANCELLED.
- AC2. A meeting that already started cannot be rescheduled → **409**.

### US-6.3 Minutes with next actions — Must
*Buku Biru: every meeting ends with decisions, next actions with PIC and deadline, and carried-over agenda;
minutes are distributed within 24 h.*
- AC1. Organizer publishes minutes: summary, decisions[], next actions[] (title, PIC member, deadline), carried-over items[], optional file.
- AC2. Each next action becomes a Task (source = meeting; linked to the meeting's proker when it has one) and its PIC is emailed.
- AC3. Publishing emails all invitees. Minutes published > 24 h after the meeting end are flagged `late`.
- AC4. Next-action PIC outside the meeting's invitees → **400**.

### US-7.2 Open attendance with a rotating QR — Must
- AC1. Organizer opens attendance → signed token expiring after 60 s, organizer screen refreshes it; closing invalidates tokens.

### US-7.3 Manual attendance — Must
- AC1. Organizer marks an invitee PRESENT (method MANUAL) or EXCUSED with an optional note.

### US-7.4 Attendance recap — Should
- AC1. Per meeting: present / excused / absent lists and counts.

---

## Dept lead (Kepala Departemen, Sekretaris Departemen)
*Buku Biru: Kadep monitors and evaluates all department elements; Sekdep handles department administration,
drafts and submits proposals/LPJ with the PJ, keeps the Proposal/SPJ/LPJ tracker, records minutes and
archives department data. In Quorum both have the same rights.*

### US-3.1 Create proker — Must
- AC1. Fields: name (unique within department and period), description, type (one of the six), executing biro (must be in my department), PIC (member of my department), event date (optional at creation), estimated budget.
- AC2. Only in my department → **403**; duplicate name → **409**; biro or PIC outside my department → **400**.
- AC3. `ProkerCreated` → email to the PIC and the biro leads.

### US-3.2 Edit, reassign and delete proker — Must
- AC1. Dept leads edit all fields, change biro or PIC (new PIC is emailed) → **200**.
- AC2. Soft delete → **200**; a proker whose proposal is APPROVED or later → **409**.

### US-3.6 Proker status — Must
- AC1. PLANNED → ONGOING → DONE, or any → CANCELLED with a reason; other transitions → **400**.
- AC2. DONE requires an LPJ in IN_REVIEW or later → **409** otherwise.

### US-5.2 Submit for review — Must
- AC1. Dept lead moves DRAFT → IN_REVIEW → **200**; file and budget required → **400**.
- AC2. The covering Sekjen Adm and Sekjen Keu are resolved from the department's kesekjenan and emailed (`DocumentSubmitted`).
- AC3. For a PROPOSAL, submitting after H-18 is allowed but marks the step `late`.
- AC4. An LPJ can be submitted only after the proker's event date → **409** before that.

### US-5.6 Kaprodi steps — Must
- AC1. After APPROVED, Dept lead marks "sent to Kaprodi" (APPROVED → AT_KAPRODI, `late` after H-14).
- AC2. Uploading the Kaprodi-signed PDF moves AT_KAPRODI → SIGNED; file rules as US-5.1.
- AC3. Dept lead or covering Sekjen Adm archives SIGNED → ARCHIVED; archived documents are read-only.

### US-6.4 Schedule a department meeting — Must
- AC1. Type DEPARTEMEN; invitees default to every element of the department; the kesekjenan's Sekjen Bidang is added as optional invitee (monitoring visit).

### US-2.7 Department overview — Must
- AC1. Biros with their leaders and staff, proker per biro with stage and checklist progress, documents in progress and their next deadline.

### US-9.2 Department dashboard — Should
- AC1. Proker progress per biro, overdue tasks per member, late documents, attendance rate per member in the current month.

---

## Sekjen Administrasi 1 & 2
*Buku Biru: guides administration, supervises Sekdep, reviews proposals/LPJ (H-18), archives kepengurusan data.
Both have the same rights; each covers one kesekjenan (Relasi or Pengembangan).*

### US-5.3 Administrative review — Must
- AC1. In IN_REVIEW, the covering Sekjen Adm approves the administrative part or returns it → REVISION with a note (≥ 10 chars).
- AC2. Not covering the document's kesekjenan → **403**; own document → **403**; already approved by me → **409**.
- AC3. When both administrative and financial approvals exist, the document moves to REVIEWED automatically and Ketua is emailed.

### US-8.4 Document tracker — Must
*Replaces the "SPS Tracker Proposal, SPJ, LPJ" spreadsheet.*
- AC1. Sekjen Adm/Keu, Dept leads and Ketua get a tracker view: every proker in scope with its proposal and LPJ stage, next deadline, and `late` flags; sortable by nearest deadline; CSV export (Should).

### US-8.5 Cabinet calendar — Should
- AC1. Month and week views with proker event dates and meetings; filters: kesekjenan, department, kind (proker / meeting).
- AC2. Dates with more than one proker event are flagged as possible clashes.
- AC3. All members see proker events; meetings show only to invitees, except Sekjen Adm and Ketua who see all.
- AC4. When a Dept lead sets a proker event date that clashes with another proker, the API returns the clash list as a warning (the save still succeeds).

---

## Sekjen Keuangan 1 & 2
*Buku Biru: checks the RAB before it goes into a proposal, supervises proposal/LPJ submission and fund
disbursement, verifies SPJ. Same rights for 1 and 2; each covers one kesekjenan.*

### US-5.4 Financial review — Must
- AC1. In IN_REVIEW, the covering Sekjen Keu approves the budget part or returns it → REVISION with a note; same 403/409 rules as US-5.3.
- AC2. For an LPJ, the screen shows the approved proposal's budget next to the realized budget and the difference (rupiah and %).

### US-13.1 RAB line items — Should
- AC1. A proposal can carry RAB lines: category (KONSUMSI, PERLENGKAPAN_TRANSPORTASI, PUBLIKASI_DOKUMENTASI, HONOR, BAHAN_HABIS_PAKAI, CETAK, ATK, LAIN_LAIN), description, quantity, unit price; totals per category and overall computed server-side; total budget must equal the sum → **400**.

### US-13.2 SPJ upload and verification — Should
- AC1. After the event, drafters in scope upload expense evidence per item (receipt image/PDF, category, amount); due ≤ H+5, flagged `late` after.
- AC2. Covering Sekjen Keu verifies or returns each SPJ; totals compared with the RAB.

### US-9.3 Budget overview — Should
- AC1. Per kesekjenan and department: approved proposal budgets vs LPJ realized budgets, by funding source.

---

## Sekjen Bidang (Pengembangan, Relasi, Personalia)
*Buku Biru: responsible to the Ketua for the departments under the kesekjenan; monitors, controls and
evaluates them; may visit department meetings; Sekjen Personalia also leads Biro Personalia.*

### US-2.8 Kesekjenan overview — Must
- AC1. Read-only view of every department in my kesekjenan: proker by stage, checklist progress, late documents, upcoming meetings.
- AC2. Sekjen Bidang outside the kesekjenan → **403**.

### US-6.5 Schedule a kesekjenan meeting — Must
- AC1. Type KESEKJENAN; invitees default to me and every element of the departments in my kesekjenan.
- AC2. Sekjen Personalia acts as Dept lead for Biro Personalia (proker, tasks, documents, meetings).

---

## Ketua Himpunan
*Buku Biru: leads and monitors the whole organization, coordinates through BPH, signs proposals before
they go to the Kaprodi.*

### US-5.5 Pengesahan (final internal approval) — Must
- AC1. Ketua moves REVIEWED → APPROVED or → REVISION (note required); others → **403**; own document → **403**.
- AC2. For a PROPOSAL, approving after H-15 is allowed but marked `late`.
- AC3. `DocumentApproved` → email to the Dept leads, PIC and biro leads.

### US-3.7 Oversee all proker — Must
- AC1. Ketua can view everything and edit proker details (not delete).

### US-6.7 BPH and Kabinet meetings — Must
*Any BPH member can organize these.*
- AC1. Type BPH → invitees Ketua and all Sekjen. Type KABINET → BPH plus every Kadep and Sekdep.

### US-9.1 Organization dashboard — Should
- AC1. Proker by stage per kesekjenan, late documents, checklist completion, attendance per department.

### US-12.1 Audit log — Could
- AC1. Changes list (who, entity, action, before/after, when) filtered by actor, entity and date.

---

## Admin (system)

### US-2.1 Manage periods — Must
- AC1. Fields: name (unique, e.g. "2026/2027"), start, end. Activating one deactivates the previous in the same transaction. Non-admin → **403**.

### US-2.2 Manage kesekjenan, departments and biros — Must
- AC1. Kesekjenan: PENGEMBANGAN, RELASI, PERSONALIA per period.
- AC2. Departments (name, code unique per period, kesekjenan, kind DEPARTMENT or SPECIAL_BIRO) and biros inside a DEPARTMENT.
- AC3. Deleting a unit that has children, proker or members → **409**.

### US-2.3 Assign memberships — Must
- AC1. Search users by name, email or NRP (paginated).
- AC2. Position ↔ unit rules: KETUA and SEKJEN_* → no unit; SEKJEN_ADMINISTRASI_* and SEKJEN_KEUANGAN_* also need `coversKesekjenan` (RELASI or PENGEMBANGAN); KADEP/SEKDEP → department of kind DEPARTMENT; KABIRO/WAKABIRO/STAFF → biro; ASISTEN_BIRO → SPECIAL_BIRO. Wrong combination → **400**.
- AC3. Single-seat positions per period (KETUA and each SEKJEN_*), per department (KADEP, SEKDEP), per biro (KABIRO, WAKABIRO) → **409**. Two Sekjen Adm (or Keu) covering the same kesekjenan → **409**.
- AC4. One active membership per user per period → **409**.

### US-2.4 Change or end a membership — Must
- AC1. Change position/unit or end a membership; access changes on the next request; ending a PIC's membership flags the proker `needs PIC`.

### US-2.5 Copy structure from the previous period — Should
- AC1. Copy kesekjenan, departments and biros (no members, no proker).

### US-2.9 First admin and HMTC seed — Must (task)
- AC1. Seed script creates the first admin from environment variables and, optionally, the Kabinet Niat Baik 2026/2027 structure (3 kesekjenan, 9 departments, Biro Personalia).

### US-2.10 Deactivate a user account — Could
- AC1. Admin deactivates an account: login → **403** with a clear message, all refresh tokens revoked immediately.
- AC2. Data and history are kept; Admin can reactivate. Deactivating your own account → **400**.
- AC3. Active memberships of the account are ended; proker it led as PIC are flagged `needs PIC`.

---

## System (scheduled jobs)

### US-10.1 Deadline reminders — Should
- AC1. Daily 07:00 WIB: task assignees with tasks due tomorrow; PIC and Dept leads with checklist items or document deadlines (H-18, H-15, H-14, H+5) due in 2 days.

### US-10.2 Minutes reminder — Should
- AC1. 20 h after a meeting ends without published minutes, the organizer gets a reminder.

---

## Scope summary
| Epic | Must | Should | Could |
| --- | --- | --- | --- |
| US-1 Auth & profile | 1.1–1.5 | 1.6 | — |
| US-2 Organization | 2.1–2.4, 2.6–2.9 | 2.5 | 2.10 |
| US-3 Proker | 3.1–3.9 | 3.10 | — |
| US-4 Tasks | 4.1–4.5 | — | 4.6 |
| US-5 Proposal & LPJ | 5.1–5.8 | — | — |
| US-6 Meetings | 6.1–6.8 | — | — |
| US-7 Attendance | 7.1–7.3 | 7.4 | — |
| US-8 Search, tracker & calendar | 8.1, 8.2, 8.4 | 8.3, 8.5 | — |
| US-9 Dashboards | — | 9.1–9.3 | — |
| US-10 Reminders | — | 10.1, 10.2 | — |
| US-11 Real-time | — | — | 11.1 |
| US-12 Audit | — | — | 12.1 |
| US-13 SPJ & RAB | — | 13.1, 13.2 | — |

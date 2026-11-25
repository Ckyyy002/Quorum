# Department services (EP-14 … EP-24)

Department-specific features and the **Mahasiswa TC** role. All of them are **Should**: build them only
after every Must story in `user-stories.md` is done. IDs match the SPS Backlog sheet
(`US-16.2` = `QRM-16-02`). Global rules G1–G10 from `user-stories.md` apply.

## New role: Mahasiswa TC
- A registered user who is not a functionary asks to be verified with NRP (10 digits, unique) and batch year.
- **Admin** approves or rejects manually (with reason; email to the applicant) and can revoke.
- Every user with an active membership counts as Mahasiswa TC automatically.
- Mahasiswa TC only sees public department services; never proker, tasks, documents or meetings → **403**.
- "Fungsionaris <DEPT>" below = any active member of that department (Kadep … Staff). "publish" actions
  are limited to that department's Kadep/Sekdep where stated.

## EP-14 Mahasiswa TC account
- **US-14.1** Guest requests verification (NRP, batch). Status PENDING / APPROVED / REJECTED (reason); can re-apply.
- **US-14.2** Admin verifies: list filtered by status/batch, search name/NRP; approve/reject with reason + email; revoke.
- **US-14.3** Mahasiswa TC home: latest competitions, community events, IA events, SRD programs, merch, open
  donation drives, my aspirations. No internal data.

## EP-15 SRD development programs
- **US-15.1** Fungsionaris SRD drafts a program (name, description, target batches, quota, registration window,
  session schedule, pass threshold % attendance); Kadep/Sekdep SRD publishes. Program with registrants can only be closed.
- **US-15.2** Mahasiswa TC registers: window open and quota left (**409** otherwise), once per program (**409**),
  cancel before window closes, confirmation email.
- **US-15.3** SRD manages participants (accept/reject when selective) and session attendance with the rotating QR
  (reuse the meeting attendance module); participants above the threshold are marked PASSED automatically.
- **US-15.4** Participant sees sessions, own attendance, attendance %, pass status.

## EP-16 SW aspirations
- **US-16.1** Mahasiswa TC submits: category (AKADEMIK, PERKULIAHAN, FASILITAS, ADMINISTRASI, LAINNYA), title, body,
  optional attachment ≤ 5 MB. **Anonymous option stores no author at all** (not even for SW) and returns a tracking
  code. Max 3 per user per day → **429**.
- **US-16.2** Fungsionaris SW: status RECEIVED → IN_PROGRESS → FORWARDED → RESOLVED, or REJECTED (reason); every
  change needs a written response; non-anonymous authors are emailed; inappropriate items can be hidden (reason).
- **US-16.3** Public list for Mahasiswa TC: category, body, status, SW responses, dates — never the author;
  filters + search; counts per category and status.
- **US-16.4** Author tracks own aspirations; anonymous ones by tracking code.

## EP-17 RT competitions
- **US-17.1** Fungsionaris RT posts: name, organizer, category (CP, CTF, UIUX, DATA, BUSINESS_PLAN, KARYA_TULIS,
  LAINNYA), level (NASIONAL, INTERNASIONAL), registration deadline, fee, official link, poster ≤ 2 MB.
  Past deadline → CLOSED automatically (derived, not stored).
- **US-17.2** Edit or archive (archived = hidden from the main list, still searchable).
- **US-17.3** Mahasiswa TC filters by category, level, status, deadline range; default nearest deadline first.

## EP-18 STI communities
- **US-18.1** Fungsionaris STI manages communities: name, kind (OLAHRAGA, ESPORT, LAINNYA), description, contact person, logo ≤ 2 MB; archive.
- **US-18.2** Only STI posts community events (community, title, description, time, place, external sign-up link, poster).
- **US-18.3** Mahasiswa TC browses events by community, kind, date; past events move to the archive.

## EP-19 EDD merch
- **US-19.1** Fungsionaris EDD manages products: name, description, sell price, cost price, variants with stock,
  ≤ 3 photos × 2 MB, archive. Cost price visible only to EDD and Sekjen Keuangan.
- **US-19.2** Record a sale (variant, qty, price, method TUNAI/TRANSFER, optional buyer) — stock decremented in the
  same transaction, overselling → **409**; cancelling restores stock; restock entries with a note. Stock changes
  are an append-only movement log.
- **US-19.3** Mahasiswa TC sees sell price and availability per variant: TERSEDIA, HAMPIR_HABIS (< 5), HABIS. Buying happens offline.
- **US-19.4** Sales report by date range (revenue, cost, profit per product, computed server-side, integer rupiah);
  Kadep/Sekdep EDD records profit deposits to the HMTC treasury (date, amount, proof); Sekjen Keuangan can view.

## EP-20 IA internal events
- **US-20.1** Fungsionaris IA drafts an event (name, description, time, place, audience FUNGSIONARIS or
  FUNGSIONARIS_DAN_MAHASISWA, optional quota, registration deadline, poster); Kadep/Sekdep IA publishes.
- **US-20.2** Register if in the audience; quota and deadline enforced (**409**); one registration per person; cancel before the deadline.
- **US-20.3** Attendance with the rotating QR; recap per department and per batch.

## EP-21 EA partners and alumni
- **US-21.1** Partners: name, kind (PERUSAHAAN, KOMUNITAS, ORMAWA, INSTANSI, MEDIA_PARTNER), contact person, notes.
- **US-21.2** Alumni: name, batch, company, position, field, contact — contact stored only when `consentToContact`
  is true (**400** otherwise).
- Partner and alumni contact data: visible only to Fungsionaris EA and BPH (**403** for others).
- **US-21.3** Collaborations: kind (SPONSORSHIP, MEDIA_PARTNER, PEMBICARA, KUNJUNGAN, MOU), optional proker,
  status (PENJAJAKAN → NEGOSIASI → DISEPAKATI → SELESAI, or BATAL), optional value, MoU PDF ≤ 10 MB, end date;
  flagged when ending within 30 days.
- **US-21.4** Any Kadep/Sekdep files a relation request for a proker (need kind, description, deadline);
  EA updates status (DITERIMA, DIPROSES, TERPENUHI, TIDAK_TERPENUHI) and links the resulting collaboration; requester emailed.

## EP-22 SSD donations
- **US-22.1** Kadep/Sekdep SSD opens/closes a drive: title, description, target, period, official account, poster.
- **US-22.2** Mahasiswa TC (or functionary) reports a donation: amount, transfer date, proof JPG/PNG/PDF ≤ 2 MB,
  display name or anonymous → PENDING.
- **US-22.3** Fungsionaris SSD verifies or rejects (reason, email). Only VERIFIED donations count.
- **US-22.4** Disbursements: date, recipient, amount, description, proof. Total disbursed > total verified → **409**.
- **US-22.5** Public transparency report: collected vs target, verified donations (name or "Anonim", amount, date),
  disbursements with proof, balance. Donor transfer proofs are never public.

## EP-23 CMI design, publication and documentation
- **US-23.1** PIC (or Kawakabiro, Kadep/Sekdep) requests a design from Biro Creative Design: kind (FEED, STORY,
  BANNER, VIDEO, LAINNYA), proker, brief, size/format, attachments, requested deadline ≥ 3 days ahead
  (assumption, confirm with CMI).
- **US-23.2** Fungsionaris CMI processes it: SUBMITTED → ACCEPTED → IN_PROGRESS → AWAITING_APPROVAL → (REVISION ↺, max 2)
  → DONE, or REJECTED (reason); assigned to one CMI designer; result uploaded; requester emailed on every change.
- **US-23.3** Requester approves the design and requests an upload to Biro Sosial Media: caption, platform
  (INSTAGRAM, LINKEDIN, X, WEBSITE), schedule. Only approved designs.
- **US-23.4** Social media schedule calendar per platform; mark POSTED with the post link; record engagement
  (reach, likes, comments) for the publication-product evaluation.
- **US-23.5** CMI uploads documentation linked to a proker or request: photos JPG/PNG ≤ 10 MB each, videos as links.
  Visible to functionaries of the owning/requesting department, CMI and BPH.

## EP-24 Personalia GDPF (Buku Biru 3.2)
- **US-24.1** Biro Personalia manages indicators per sub-value: 11 sub-values in 4 aspects (Pendidikan,
  Kesejahteraan, Harmonis, Suportif), each indicator SUBJECTIVE_360 or OBJECTIVE with a weight. Indicators used in
  an open assessment period are locked (**409**).
- **US-24.2** Open a semester assessment period (open/close dates); raters generated automatically (direct
  superior, peers in the same biro/department, direct reports), adjustable by Personalia; raters emailed.
- **US-24.3** Functionary fills 360 ratings (1–5 per subjective indicator, optional comment) only while open;
  rater identity is never shown to the person rated.
- **US-24.4** Personalia fills objective scores with supporting data computed from Quorum: meeting attendance
  rate, tasks done on time, late checklist items/documents.
- **US-24.5** 1-on-1 notes (date, PIC, summary, follow-up) visible only to Personalia and the person.
- **US-24.6** Publish the semester report: per-sub-value score = weighted subjective + objective (computed
  server-side); requires a recorded 1-on-1 (**409**); the person sees their own, Dept leads see their department;
  individual rater scores never shown.
- **US-24.7** Functionary views own report (scores per sub-value and aspect, anonymised 360 comments, 1-on-1 notes).
- **US-24.8** Appreciation: automatic ranking from reports; categories Staf (best per department and the bureau,
  10 total), Kawakabiro (top 3), Kepala Departemen (top 3), Sekretaris Departemen (top 3); Personalia confirms before
  announcing; winners shown on the functionary home page.

## Reuse, not rebuild
- QR attendance (US-7) is reused for SRD sessions and IA events: model attendance against a generic "attendable"
  (meeting, program session, event) rather than copying the module.
- File uploads reuse the upload module rules (magic bytes, size limits, private storage, permission-checked download).
- Search/pagination conventions (G4) apply to every public list.

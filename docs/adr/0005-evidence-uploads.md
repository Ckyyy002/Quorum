# ADR-0005: Evidence (link or file) is required to finish tasks and checklist items

- Status: Accepted
- Date: 2026-11-26

## Context
The user asked that finishing a task or a checklist item needs proof, either a link or an uploaded file,
and that either one is enough. Until now nothing was uploaded in Quorum; `FileAttachment` existed only for
proposal/LPJ versions (US-5), with a required `documentId`.

## Decision
- A new `UploadModule` (no routes) stores files: Multer keeps the upload in memory, `file-type` reads the
  magic bytes, the detected type must be JPG, PNG, WebP, PDF, DOCX, XLSX or PPTX and agree with the declared
  type (400), the size is capped at 10 MB (413). The file is written to `UPLOAD_DIR` (default
  `apps/api/uploads`) under a random name; the client filename is kept for display only.
- `FileAttachment` is shared: `documentId` and `version` become optional, kind `EVIDENCE` is added.
  `Task.evidenceFileId` and `ChecklistItem.evidenceFileId` point at it (`Task.evidenceUrl` is new;
  `ChecklistItem.evidenceUrl` already existed).
- `PUT …/evidence` (multipart: `evidenceUrl` and/or `file`) sets the proof; a new file replaces the old one,
  whose row and bytes are removed. `GET …/evidence/file` streams it as an attachment to any member.
- Moving a task to DONE or ticking a checklist item without a link or file is a 400 (`hasEvidence`).
- `file-type` is ESM-only; Node 24 loads it through `require(esm)` like the Nest packages (ADR-0003).

## Alternatives considered
- One multipart request that both uploads and changes status: mixes JSON and multipart on the status
  route, and a failed status change would leave an uploaded file behind anyway.
- A separate `EvidenceFile` table: duplicates `FileAttachment` and breaks rule 8 ("metadata in FileAttachment").
- Evidence optional: simpler, but the user wants finished work to be provable.

## Consequences
- Tasks marked DONE before this change keep DONE without evidence; reopening and finishing again asks for it.
- US-5 reuses `UploadService` for document versions (with its own allowed types).
- Replacing a file is two writes (new row, then old row removed); if the second fails, an orphan row and
  file remain, which is harmless and rare.

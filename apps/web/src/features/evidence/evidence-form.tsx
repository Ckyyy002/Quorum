import { Link2, Paperclip } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/features/auth/form-field';
import { ErrorText } from '@/features/org/org-forms';
import {
  downloadEvidence,
  EVIDENCE_ACCEPT,
  MAX_EVIDENCE_BYTES,
  hasEvidence,
  type Evidence,
} from './evidence';

/**
 * "Bukti selesai": a link, a file, or both — one is enough (decided by the user). Existing evidence also
 * counts, so finishing again after a reopen needs no new input.
 */
export function EvidenceForm(props: {
  idPrefix: string;
  current: Evidence;
  submitLabel: string;
  onSubmit: (input: { evidenceUrl?: string; file?: File }) => Promise<unknown>;
  onCancel: () => void;
  /** Error from the server call, shown under the fields. */
  error: string | null;
}) {
  const [link, setLink] = useState(props.current.evidenceUrl ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = (f: string) => `${props.idPrefix}-${f}`;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const url = link.trim();
    if (url && !/^https?:\/\/\S+$/.test(url))
      return setProblem('Link harus diawali http:// atau https://');
    if (file && file.size > MAX_EVIDENCE_BYTES) return setProblem('Ukuran file maksimal 10 MB.');
    if (!url && !file && !hasEvidence(props.current)) {
      return setProblem('Isi link atau pilih file sebagai bukti.');
    }
    setProblem(null);
    setBusy(true);
    try {
      await props.onSubmit({
        // Send the link only when it changed, so an untouched field does not overwrite anything.
        ...(url !== (props.current.evidenceUrl ?? '') && { evidenceUrl: url }),
        ...(file && { file }),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(e) => void submit(e)}
      className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3"
    >
      <p className="text-sm font-semibold">
        Bukti selesai — isi link atau unggah file (cukup salah satu)
      </p>
      <FormField id={id('link')} label="Link bukti">
        <div className="relative">
          <Link2 className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={id('link')}
            className="pl-8"
            placeholder="https://drive.google.com/…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
        </div>
      </FormField>
      <FormField
        id={id('file')}
        label="File bukti"
        hint={
          props.current.evidenceFile && !file
            ? `Sudah ada: ${props.current.evidenceFile.originalName} (pilih file baru untuk mengganti)`
            : 'JPG, PNG, WebP, PDF, DOCX, XLSX, PPTX · maks 10 MB'
        }
      >
        <label
          htmlFor={id('file')}
          className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-card px-3 text-sm hover:bg-accent"
        >
          <Paperclip className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="truncate">{file ? file.name : 'Pilih file…'}</span>
        </label>
        <input
          id={id('file')}
          type="file"
          accept={EVIDENCE_ACCEPT}
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </FormField>
      <ErrorText>{problem ?? props.error}</ErrorText>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? 'Menyimpan…' : props.submitLabel}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={props.onCancel}>
          Batal
        </Button>
      </div>
    </form>
  );
}

/** The evidence of a finished item: a link to open, and/or a file to download. */
export function EvidenceView({ evidence, filePath }: { evidence: Evidence; filePath: string }) {
  const [error, setError] = useState(false);
  if (!hasEvidence(evidence)) return null;
  const file = evidence.evidenceFile;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
      {evidence.evidenceUrl && (
        <a
          href={evidence.evidenceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <Link2 className="size-3" aria-hidden="true" /> Link bukti
        </a>
      )}
      {file && (
        <button
          type="button"
          className="inline-flex max-w-56 items-center gap-1 text-primary hover:underline"
          onClick={() => {
            setError(false);
            downloadEvidence(filePath, file.originalName).catch(() => setError(true));
          }}
        >
          <Paperclip className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{file.originalName}</span>
        </button>
      )}
      {error && <span className="text-destructive">Gagal mengunduh</span>}
    </span>
  );
}

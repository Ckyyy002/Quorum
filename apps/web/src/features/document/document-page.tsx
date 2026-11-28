import { ArrowLeft, Download } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import type { Me } from '@/features/auth/auth-api';
import { downloadEvidence } from '@/features/evidence/evidence';
import { ErrorText } from '@/features/org/org-forms';
import { POSITION_LABEL, type Position } from '@/features/org/positions';
import { formatDay, formatRupiah } from '@/features/proker/labels';
import { useProker, type ProkerDetail } from '@/features/proker/proker-api';
import { cn } from '@/lib/utils';
import {
  ACTION_LABEL,
  documentErrorMessage,
  FUNDING_LABEL,
  STEP_LABEL,
  TYPE_LABEL,
  useDocument,
  useDocumentStep,
  useUpdateDocument,
  useUploadSigned,
  type DocumentDetail,
} from './document-api';
import { RabSection, SpjSection } from './budget-section';
import { DecisionForm } from './decision-form';
import { DocumentForm } from './document-form';
import { budgetRights, documentRights } from './document-rights';
import { DocumentStatusBadge } from './document-section';

const formatTime = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(iso));

/** US-5.2–5.8, US-13: one document with every action the user may take on it, its files and its history. */
export function DocumentPage() {
  const { id = '' } = useParams();
  const { state } = useAuth();
  const doc = useDocument(id);
  const proker = useProker(doc.data?.proker.id ?? '');

  if (state.status !== 'authenticated') return null;
  if (doc.isError) return <ErrorText>{documentErrorMessage(doc.error)}</ErrorText>;
  if (!doc.data || !proker.data) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Memuat…
      </p>
    );
  }
  const d = doc.data;
  const budget = budgetRights(state.user, proker.data, d);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          to={`/proker/${d.proker.id}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="size-4" /> {d.proker.name}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{d.title}</h1>
          <DocumentStatusBadge status={d.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {TYPE_LABEL[d.type]} · {formatRupiah(d.totalBudget)}
          {d.fundingSource && ` · ${FUNDING_LABEL[d.fundingSource]}`} · versi {d.version} · dibuat
          oleh {d.author.name} · acara {formatDay(d.proker.eventDate)}
        </p>
        <p className="text-sm text-muted-foreground">
          Administrasi: {d.adminApprovedBy ? `✓ ${d.adminApprovedBy.name}` : 'belum'} · Keuangan:{' '}
          {d.financeApprovedBy ? `✓ ${d.financeApprovedBy.name}` : 'belum'}
        </p>
      </div>

      <Actions me={state.user} proker={proker.data} doc={d} />
      {d.type === 'PROPOSAL' ? (
        <RabSection doc={d} canEdit={budget.rab} />
      ) : (
        <SpjSection doc={d} canUpload={budget.spj} canVerify={budget.verifySpj} />
      )}
      {d.budgetComparison && <BudgetComparison {...d.budgetComparison} />}
      {d.deadlines.length > 0 && <Deadlines doc={d} />}
      <Versions doc={d} />
      <Timeline doc={d} />
    </section>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </div>
  );
}

/** The buttons follow `documentRights`; each step's 409 gets a message that says why. */
function Actions({ me, proker, doc }: { me: Me; proker: ProkerDetail; doc: DocumentDetail }) {
  const rights = documentRights(me, proker, doc);
  const step = useDocumentStep(doc.id);
  const [editing, setEditing] = useState(false);
  const [deciding, setDeciding] = useState<'review' | 'pengesahan' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>, conflict?: string) => {
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(documentErrorMessage(e, conflict));
      return false;
    }
  };
  const simple = (path: string, conflict?: string) => () =>
    void run(() => step.mutateAsync({ step: path }), conflict);

  if (editing) return <EditDocument doc={doc} onDone={() => setEditing(false)} />;
  if (deciding) {
    return (
      <DecisionForm
        title={deciding === 'review' ? 'Review dokumen' : 'Pengesahan'}
        error={error}
        onCancel={() => setDeciding(null)}
        onSubmit={async (body) => {
          if (await run(() => step.mutateAsync({ step: deciding, body }))) setDeciding(null);
        }}
      />
    );
  }

  const any = Object.values(rights).some(Boolean);
  if (!any) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {rights.edit && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            Ubah / unggah versi baru
          </Button>
        )}
        {rights.submit && (
          <Button
            onClick={simple(
              'submit',
              'Belum bisa diajukan: LPJ hanya setelah hari acara, dan proposal Proyek Besar butuh Sekben dan Kadiv di panitia.',
            )}
          >
            Ajukan ke Sekjen
          </Button>
        )}
        {rights.review && <Button onClick={() => setDeciding('review')}>Review</Button>}
        {rights.pengesahan && <Button onClick={() => setDeciding('pengesahan')}>Pengesahan</Button>}
        {rights.kaprodiDiscussion && (
          <Button variant="outline" onClick={simple('kaprodi-discussion')}>
            Tandai diskusi Kaprodi selesai
          </Button>
        )}
        {rights.toKaprodi && (
          <Button onClick={simple('to-kaprodi')}>Tandai dikirim ke Kaprodi</Button>
        )}
        {rights.sign && <SignedUpload docId={doc.id} onError={setError} />}
        {rights.archive && (
          <Button variant="outline" onClick={simple('archive')}>
            Arsipkan
          </Button>
        )}
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

function EditDocument({ doc, onDone }: { doc: DocumentDetail; onDone: () => void }) {
  const update = useUpdateDocument(doc.id);
  const [error, setError] = useState<string | null>(null);
  return (
    <DocumentForm
      idPrefix="edit-doc"
      type={doc.type}
      defaults={doc}
      submitLabel="Simpan"
      error={error}
      onCancel={onDone}
      onSubmit={async (input) => {
        setError(null);
        try {
          await update.mutateAsync(input);
          onDone();
        } catch (e) {
          setError(documentErrorMessage(e, 'Dokumen sedang direview, jadi belum bisa diubah.'));
        }
      }}
    />
  );
}

function SignedUpload({ docId, onError }: { docId: string; onError: (e: string | null) => void }) {
  const upload = useUploadSigned(docId);
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium">Unggah PDF bertanda tangan Kaprodi:</span>
      <Input
        type="file"
        accept=".pdf"
        className="max-w-64"
        disabled={upload.isPending}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          onError(null);
          upload.mutate(file, { onError: (err) => onError(documentErrorMessage(err)) });
        }}
      />
    </label>
  );
}

/** US-5.4 AC2: realized against approved, so the Sekjen Keu sees the gap at a glance. */
function BudgetComparison(b: NonNullable<DocumentDetail['budgetComparison']>) {
  return (
    <Panel title="Anggaran: proposal vs realisasi">
      <dl className="grid gap-3 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Disetujui (proposal)</dt>
          <dd className="font-semibold">{formatRupiah(b.approved)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Terealisasi (LPJ)</dt>
          <dd className="font-semibold">{formatRupiah(b.realized)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Selisih</dt>
          <dd className={cn('font-semibold', b.rupiah > 0 && 'text-destructive')}>
            {b.rupiah > 0 && '+'}
            {formatRupiah(b.rupiah)}
            {b.percent !== null && ` (${b.percent > 0 ? '+' : ''}${b.percent}%)`}
          </dd>
        </div>
      </dl>
    </Panel>
  );
}

const STATE_TEXT = { DONE: 'Tepat waktu', LATE: 'Terlambat', PENDING: 'Belum' } as const;

function Deadlines({ doc }: { doc: DocumentDetail }) {
  return (
    <Panel title="Tenggat">
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {doc.deadlines.map((d) => (
          <li
            key={d.step}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
          >
            <span>{STEP_LABEL[d.step] ?? d.step}</span>
            <span className="flex items-center gap-3 text-muted-foreground">
              {formatDay(d.dueDate)}
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  d.state === 'LATE' && 'bg-destructive/10 text-destructive',
                  d.state === 'DONE' && 'bg-emerald-100 text-emerald-800',
                  d.state === 'PENDING' && 'bg-muted',
                )}
              >
                {STATE_TEXT[d.state]}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Versions({ doc }: { doc: DocumentDetail }) {
  const [error, setError] = useState<string | null>(null);
  if (doc.attachments.length === 0) {
    return (
      <Panel title="File">
        <p className="text-sm text-muted-foreground">Belum ada file. Unggah sebelum diajukan.</p>
      </Panel>
    );
  }
  return (
    <Panel title="File">
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {doc.attachments.map((a) => (
          <li
            key={a.id}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
          >
            <span>
              <span className="font-semibold">
                {a.kind === 'SIGNED' ? 'Bertanda tangan Kaprodi' : `Versi ${a.version}`}
              </span>{' '}
              · {a.originalName} · {a.uploadedBy.name} · {formatTime(a.createdAt)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                void downloadEvidence(`/documents/${doc.id}/files/${a.id}`, a.originalName).catch(
                  (e: unknown) => setError(documentErrorMessage(e)),
                )
              }
            >
              <Download /> Unduh
            </Button>
          </li>
        ))}
      </ul>
      <ErrorText>{error}</ErrorText>
    </Panel>
  );
}

/** US-5.8: every step with who did it, in which position, and the note (kept visible after a revision). */
function Timeline({ doc }: { doc: DocumentDetail }) {
  return (
    <Panel title="Riwayat">
      {doc.approvalLogs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum diajukan.</p>
      ) : (
        <ol className="flex flex-col gap-3 border-l-2 border-border pl-4">
          {doc.approvalLogs.map((log) => (
            <li key={log.id} className="flex flex-col gap-0.5 text-sm">
              <span className="font-semibold">{ACTION_LABEL[log.action] ?? log.action}</span>
              <span className="text-muted-foreground">
                {log.actor.name}
                {log.actorPosition && ` (${POSITION_LABEL[log.actorPosition as Position]})`} ·{' '}
                {formatTime(log.createdAt)}
              </span>
              {log.note && <q className="rounded-lg bg-muted px-3 py-1.5 italic">{log.note}</q>}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

import { FileText, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { ErrorText } from '@/features/org/org-forms';
import { formatRupiah } from '@/features/proker/labels';
import type { ProkerDetail } from '@/features/proker/proker-api';
import { cn } from '@/lib/utils';
import {
  DOCUMENT_TYPES,
  documentErrorMessage,
  STATUS_LABEL,
  TYPE_LABEL,
  useCreateDocument,
  useProkerDocuments,
  type DocumentStatus,
  type DocumentType,
} from './document-api';
import { DocumentForm } from './document-form';

const STATUS_CLASS: Record<DocumentStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  REVISION: 'bg-destructive/10 text-destructive',
  IN_REVIEW: 'bg-amber-100 text-amber-800',
  REVIEWED: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-sky-100 text-sky-800',
  AT_KAPRODI: 'bg-sky-100 text-sky-800',
  SIGNED: 'bg-emerald-100 text-emerald-800',
  ARCHIVED: 'bg-emerald-100 text-emerald-800',
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_CLASS[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

/**
 * US-5.1: one card per document type. The proker has at most one live PROPOSAL and one LPJ, so a missing
 * one shows a "create" button to the people who draft (D, B, P).
 */
export function DocumentSection({ proker, canDraft }: { proker: ProkerDetail; canDraft: boolean }) {
  const documents = useProkerDocuments(proker.id);
  const [creating, setCreating] = useState<DocumentType | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl font-bold">Proposal &amp; LPJ</h2>
      {documents.isError && <ErrorText>{documentErrorMessage(documents.error)}</ErrorText>}
      {creating ? (
        <CreateDocument proker={proker} type={creating} onDone={() => setCreating(null)} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {DOCUMENT_TYPES.map((type) => {
            const doc = documents.data?.find((d) => d.type === type);
            return (
              <li
                key={type}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
              >
                <span className="text-xs font-semibold text-muted-foreground uppercase">
                  {TYPE_LABEL[type]}
                </span>
                {doc ? (
                  <Link to={`/dokumen/${doc.id}`} className="flex flex-col gap-1 hover:underline">
                    <span className="flex items-center gap-2 font-semibold">
                      <FileText className="size-4" />
                      {doc.title}
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <DocumentStatusBadge status={doc.status} />
                      {formatRupiah(doc.totalBudget)} · versi {doc.version}
                    </span>
                  </Link>
                ) : canDraft ? (
                  <Button
                    variant="outline"
                    className="self-start"
                    onClick={() => setCreating(type)}
                  >
                    <Plus /> Buat {TYPE_LABEL[type]}
                  </Button>
                ) : (
                  <span className="text-sm text-muted-foreground">Belum ada.</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CreateDocument(props: { proker: ProkerDetail; type: DocumentType; onDone: () => void }) {
  const create = useCreateDocument(props.proker.id);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  return (
    <DocumentForm
      idPrefix={`new-${props.type}`}
      type={props.type}
      submitLabel={`Simpan draf ${TYPE_LABEL[props.type]}`}
      error={error}
      onCancel={props.onDone}
      onSubmit={async (input) => {
        setError(null);
        try {
          const doc = await create.mutateAsync({ ...input, type: props.type });
          await navigate(`/dokumen/${doc.id}`);
        } catch (e) {
          setError(
            documentErrorMessage(
              e,
              `Proker ini sudah punya ${TYPE_LABEL[props.type]}. Muat ulang halaman.`,
            ),
          );
        }
      }}
    />
  );
}

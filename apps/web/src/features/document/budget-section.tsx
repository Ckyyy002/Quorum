import { zodResolver } from '@hookform/resolvers/zod';
import { Download, Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/features/auth/form-field';
import { downloadEvidence, MAX_EVIDENCE_BYTES } from '@/features/evidence/evidence';
import { ErrorText, selectClass } from '@/features/org/org-forms';
import { formatRupiah } from '@/features/proker/labels';
import { cn } from '@/lib/utils';
import { DecisionForm } from './decision-form';
import {
  BUDGET_CATEGORIES,
  CATEGORY_LABEL,
  documentErrorMessage,
  SPJ_ACCEPT,
  useSaveSpj,
  useSetRab,
  useVerifySpj,
  type DocumentDetail,
  type SpjItem,
  type SpjStatus,
} from './document-api';

const box = 'rounded-xl border border-border bg-card';
const th = 'px-3 py-2 text-left font-medium text-muted-foreground';
const td = 'px-3 py-2';
const num = 'text-right tabular-nums';
const whole = (max: number, min = 0) =>
  z
    .string()
    .regex(/^\d+$/, 'Angka bulat tanpa titik')
    .refine((v) => Number(v) >= min, `Minimal ${min}`)
    .refine((v) => Number(v) <= max, 'Terlalu besar');

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </div>
  );
}

// ───────────────────────────── RAB (US-13.1) ─────────────────────────────

/** The proposal's RAB: lines, then totals per category; drafters edit the whole list at once. */
export function RabSection({ doc, canEdit }: { doc: DocumentDetail; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <RabEditor doc={doc} onDone={() => setEditing(false)} />;
  return (
    <Panel title="RAB (rencana anggaran biaya)">
      {doc.rabLines.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada RAB. Proposal baru bisa diajukan setelah RAB diisi.
        </p>
      ) : (
        <div className={cn(box, 'overflow-x-auto')}>
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className={th}>Kategori</th>
                <th className={th}>Uraian</th>
                <th className={cn(th, num)}>Jumlah</th>
                <th className={cn(th, num)}>Harga satuan</th>
                <th className={cn(th, num)}>Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {doc.rabLines.map((l) => (
                <tr key={l.id}>
                  <td className={td}>{CATEGORY_LABEL[l.category]}</td>
                  <td className={td}>{l.description}</td>
                  <td className={cn(td, num)}>{l.quantity}</td>
                  <td className={cn(td, num)}>{formatRupiah(l.unitPrice)}</td>
                  <td className={cn(td, num)}>{formatRupiah(l.quantity * l.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-border">
              {doc.budget.rows.map((r) => (
                <tr key={r.category} className="text-muted-foreground">
                  <td className={td} colSpan={4}>
                    Total {CATEGORY_LABEL[r.category]}
                  </td>
                  <td className={cn(td, num)}>{formatRupiah(r.rab)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className={td} colSpan={4}>
                  Total anggaran
                </td>
                <td className={cn(td, num)}>{formatRupiah(doc.budget.total.rab)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {canEdit && (
        <div>
          <Button variant="outline" onClick={() => setEditing(true)}>
            {doc.rabLines.length ? 'Ubah RAB' : 'Isi RAB'}
          </Button>
        </div>
      )}
    </Panel>
  );
}

// Same limits as RabLineDto in apps/api/src/document/dto/document.dto.ts.
const rabSchema = z.object({
  lines: z.array(
    z.object({
      category: z.enum(BUDGET_CATEGORIES),
      description: z.string().trim().min(1, 'Wajib diisi').max(200, 'Maksimal 200 karakter'),
      quantity: whole(100_000, 1),
      unitPrice: whole(2_000_000_000),
    }),
  ),
});
type RabValues = z.infer<typeof rabSchema>;
const EMPTY_LINE = {
  category: 'KONSUMSI',
  description: '',
  quantity: '1',
  unitPrice: '0',
} as const;

function RabEditor({ doc, onDone }: { doc: DocumentDetail; onDone: () => void }) {
  const save = useSetRab(doc.id);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RabValues>({
    resolver: zodResolver(rabSchema),
    defaultValues: {
      lines: doc.rabLines.length
        ? doc.rabLines.map((l) => ({
            category: l.category,
            description: l.description,
            quantity: String(l.quantity),
            unitPrice: String(l.unitPrice),
          }))
        : [EMPTY_LINE],
    },
  });
  const lines = useFieldArray({ control, name: 'lines' });
  const watched = useWatch({ control, name: 'lines' });
  // Preview only; the API computes the real total from the saved lines.
  const total = watched.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unitPrice) || 0, 0);

  return (
    <form
      noValidate
      className={cn(box, 'flex flex-col gap-3 p-4')}
      onSubmit={(e) =>
        void handleSubmit(async (v) => {
          setError(null);
          try {
            await save.mutateAsync(
              v.lines.map((l) => ({
                ...l,
                quantity: Number(l.quantity),
                unitPrice: Number(l.unitPrice),
              })),
            );
            onDone();
          } catch (err) {
            setError(
              documentErrorMessage(
                err,
                'RAB hanya bisa diubah saat proposal masih draf atau revisi.',
              ),
            );
          }
        })(e)
      }
    >
      <h2 className="font-bold">RAB</h2>
      {lines.fields.map((field, i) => {
        const err = errors.lines?.[i];
        const id = (name: string) => `rab-${i}-${name}`;
        return (
          <div
            key={field.id}
            className="grid gap-2 rounded-lg border border-border bg-background p-3 sm:grid-cols-[1fr_2fr_6rem_9rem_auto]"
          >
            <FormField id={id('category')} label="Kategori">
              <select
                id={id('category')}
                className={selectClass}
                {...register(`lines.${i}.category`)}
              >
                {BUDGET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id={id('description')} label="Uraian" error={err?.description?.message}>
              <Input id={id('description')} {...register(`lines.${i}.description`)} />
            </FormField>
            <FormField id={id('quantity')} label="Jumlah" error={err?.quantity?.message}>
              <Input id={id('quantity')} inputMode="numeric" {...register(`lines.${i}.quantity`)} />
            </FormField>
            <FormField id={id('price')} label="Harga satuan (Rp)" error={err?.unitPrice?.message}>
              <Input id={id('price')} inputMode="numeric" {...register(`lines.${i}.unitPrice`)} />
            </FormField>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="self-end"
              aria-label={`Hapus baris ${i + 1}`}
              onClick={() => lines.remove(i)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" onClick={() => lines.append(EMPTY_LINE)}>
          <Plus className="size-4" /> Tambah baris
        </Button>
        <span className="text-sm font-semibold">Total: {formatRupiah(total)}</span>
      </div>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          Simpan RAB
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Batal
        </Button>
      </div>
    </form>
  );
}

// ───────────────────────────── SPJ (US-13.2) ─────────────────────────────

const SPJ_STATUS: Record<SpjStatus, { label: string; className: string }> = {
  PENDING: { label: 'Menunggu verifikasi', className: 'bg-muted' },
  VERIFIED: { label: 'Terverifikasi', className: 'bg-emerald-100 text-emerald-800' },
  RETURNED: { label: 'Dikembalikan', className: 'bg-destructive/10 text-destructive' },
};

const Badge = ({ className, children }: { className: string; children: ReactNode }) => (
  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', className)}>
    {children}
  </span>
);

/** The LPJ's receipts against the proposal's RAB; drafters upload and fix, the covering Sekjen Keu verifies. */
export function SpjSection(props: { doc: DocumentDetail; canUpload: boolean; canVerify: boolean }) {
  const { doc } = props;
  const [adding, setAdding] = useState(false);
  return (
    <Panel title="SPJ (bukti pengeluaran)">
      <p className="text-sm text-muted-foreground">
        Diunggah setelah hari acara, paling lambat H+5. Sekjen Keuangan memverifikasi tiap nota.
      </p>
      {doc.budget.rows.length > 0 && <SpjComparison doc={doc} />}
      {doc.spjItems.length > 0 && (
        <ul className={cn(box, 'flex flex-col divide-y divide-border')}>
          {doc.spjItems.map((item) => (
            <SpjRow key={item.id} item={item} {...props} />
          ))}
        </ul>
      )}
      {props.canUpload &&
        (adding ? (
          <SpjForm docId={doc.id} onDone={() => setAdding(false)} />
        ) : (
          <div>
            <Button variant="outline" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Unggah nota
            </Button>
          </div>
        ))}
    </Panel>
  );
}

/** US-13.2 AC2: per category, what the RAB planned, what was claimed and what is verified. */
function SpjComparison({ doc }: { doc: DocumentDetail }) {
  const { rows, total } = doc.budget;
  return (
    <div className={cn(box, 'overflow-x-auto')}>
      <table className="w-full text-sm">
        <thead className="border-b border-border">
          <tr>
            <th className={th}>Kategori</th>
            <th className={cn(th, num)}>RAB</th>
            <th className={cn(th, num)}>Diajukan</th>
            <th className={cn(th, num)}>Terverifikasi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {[...rows, { category: null, ...total }].map((r) => (
            <tr key={r.category ?? 'total'} className={cn(!r.category && 'font-semibold')}>
              <td className={td}>{r.category ? CATEGORY_LABEL[r.category] : 'Total'}</td>
              <td className={cn(td, num)}>{formatRupiah(r.rab)}</td>
              <td className={cn(td, num, r.claimed > r.rab && 'text-destructive')}>
                {formatRupiah(r.claimed)}
              </td>
              <td className={cn(td, num)}>{formatRupiah(r.verified)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SpjRow(props: {
  doc: DocumentDetail;
  item: SpjItem;
  canUpload: boolean;
  canVerify: boolean;
}) {
  const { doc, item } = props;
  const verify = useVerifySpj(doc.id);
  const [mode, setMode] = useState<'fix' | 'verify' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = SPJ_STATUS[item.status];

  if (mode === 'fix') {
    return (
      <li className="p-3">
        <SpjForm docId={doc.id} item={item} onDone={() => setMode(null)} />
      </li>
    );
  }
  if (mode === 'verify') {
    return (
      <li className="p-3">
        <DecisionForm
          title={`Verifikasi: ${item.description}`}
          error={error}
          onCancel={() => setMode(null)}
          onSubmit={async (body) => {
            setError(null);
            try {
              await verify.mutateAsync({ itemId: item.id, body });
              setMode(null);
            } catch (e) {
              setError(documentErrorMessage(e, 'Nota ini sudah diputuskan. Muat ulang halaman.'));
            }
          }}
        />
      </li>
    );
  }
  return (
    <li className="flex flex-col gap-1.5 px-4 py-2.5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="font-semibold">{item.description}</span> ·{' '}
          {CATEGORY_LABEL[item.category]} · {formatRupiah(item.amount)}
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {item.late && <Badge className="bg-destructive/10 text-destructive">Lewat H+5</Badge>}
          <Badge className={status.className}>{status.label}</Badge>
        </span>
      </div>
      <span className="text-muted-foreground">
        {item.uploadedBy.name}
        {item.verifiedBy && ` · diputuskan ${item.verifiedBy.name}`}
      </span>
      {item.note && <q className="rounded-lg bg-muted px-3 py-1.5 italic">{item.note}</q>}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            void downloadEvidence(
              `/documents/${doc.id}/spj/${item.id}/file`,
              item.file.originalName,
            ).catch((e: unknown) => setError(documentErrorMessage(e)))
          }
        >
          <Download /> Nota
        </Button>
        {props.canVerify && item.status === 'PENDING' && (
          <Button size="sm" onClick={() => setMode('verify')}>
            Verifikasi
          </Button>
        )}
        {props.canUpload && item.status !== 'VERIFIED' && (
          <Button size="sm" variant="outline" onClick={() => setMode('fix')}>
            Perbaiki
          </Button>
        )}
      </div>
      <ErrorText>{error}</ErrorText>
    </li>
  );
}

// Same limits as CreateSpjDto; the receipt is required for a new item and optional for a fix.
const spjSchema = z.object({
  category: z.enum(BUDGET_CATEGORIES),
  description: z.string().trim().min(1, 'Wajib diisi').max(200, 'Maksimal 200 karakter'),
  amount: whole(2_000_000_000, 1),
  file: z
    .custom<FileList>()
    .refine(
      (list) => !list?.[0] || list[0].size <= MAX_EVIDENCE_BYTES,
      'Ukuran file maksimal 10 MB',
    ),
});
type SpjValues = z.infer<typeof spjSchema>;

function SpjForm({ docId, item, onDone }: { docId: string; item?: SpjItem; onDone: () => void }) {
  const save = useSaveSpj(docId);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError: setFieldError,
    formState: { errors, isSubmitting },
  } = useForm<SpjValues>({
    resolver: zodResolver(spjSchema),
    defaultValues: {
      category: item?.category ?? 'KONSUMSI',
      description: item?.description ?? '',
      amount: item ? String(item.amount) : '',
    },
  });
  const id = (field: string) => `spj-${item?.id ?? 'new'}-${field}`;

  return (
    <form
      noValidate
      className={cn(box, 'flex flex-col gap-3 p-4')}
      onSubmit={(e) =>
        void handleSubmit(async (v) => {
          const file = v.file?.[0];
          if (!item && !file)
            return setFieldError('file', { message: 'Unggah foto atau scan nota' });
          setError(null);
          try {
            await save.mutateAsync({
              itemId: item?.id,
              category: v.category,
              description: v.description,
              amount: Number(v.amount),
              ...(file && { file }),
            });
            onDone();
          } catch (err) {
            setError(
              documentErrorMessage(
                err,
                'SPJ hanya bisa diunggah setelah hari acara, selama LPJ masih draf atau revisi.',
              ),
            );
          }
        })(e)
      }
    >
      <h2 className="font-bold">{item ? 'Perbaiki nota' : 'Unggah nota'}</h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr_10rem]">
        <FormField id={id('category')} label="Kategori">
          <select id={id('category')} className={selectClass} {...register('category')}>
            {BUDGET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id={id('description')} label="Uraian" error={errors.description?.message}>
          <Input id={id('description')} {...register('description')} />
        </FormField>
        <FormField id={id('amount')} label="Nominal (Rp)" error={errors.amount?.message}>
          <Input id={id('amount')} inputMode="numeric" {...register('amount')} />
        </FormField>
      </div>
      <FormField
        id={id('file')}
        label={item ? 'Nota baru (opsional)' : 'Foto atau scan nota'}
        hint="JPG, PNG, WebP atau PDF, maksimal 10 MB."
        error={errors.file?.message}
      >
        <Input id={id('file')} type="file" accept={SPJ_ACCEPT} {...register('file')} />
      </FormField>
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          Simpan
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Batal
        </Button>
      </div>
    </form>
  );
}

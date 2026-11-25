import { Check, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import { FormField } from '@/features/auth/form-field';
import { ErrorText, selectClass } from '@/features/org/org-forms';
import { useDepartmentOverview } from '@/features/org/org-api';
import { POSITION_LABEL } from '@/features/org/positions';
import { CommitteeSection } from './committee-section';
import { dayInput, formatDay, formatRupiah, TYPE_LABEL } from './labels';
import { prokerRights } from './permissions';
import { ProgressCell, StatusBadge } from './progress-table';
import { ProkerForm } from './proker-form';
import {
  prokerErrorMessage,
  useAssignProker,
  useChangeStatus,
  useDeleteProker,
  useProker,
  useProkerMembers,
  useTickItem,
  useUpdateProker,
  type ProkerDetail,
  type ProkerStatus,
} from './proker-api';

/** Run an action and keep its Indonesian error message; one per section so errors show in place. */
function useAction() {
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>, conflict = '') => {
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(prokerErrorMessage(e, conflict));
      return false;
    }
  };
  return { error, run };
}

export function ProkerDetailPage() {
  const { id = '' } = useParams();
  const { state } = useAuth();
  const proker = useProker(id);

  if (state.status !== 'authenticated') return null;
  if (proker.isPending) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Memuat…
      </p>
    );
  }
  if (proker.isError) {
    return <ErrorText>{prokerErrorMessage(proker.error)}</ErrorText>;
  }
  const p = proker.data;
  const rights = prokerRights(state.user, p);

  return (
    <section className="flex flex-col gap-6">
      <Header proker={p} canEdit={rights.edit} canDelete={rights.manage} />
      {rights.status && <StatusActions proker={p} />}
      {rights.manage && <AssignmentSection proker={p} />}
      <ChecklistSection proker={p} canTick={rights.tick} />
      <CommitteeSection proker={p} canEdit={rights.committee} />
    </section>
  );
}

function Header({
  proker: p,
  canEdit,
  canDelete,
}: {
  proker: ProkerDetail;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const update = useUpdateProker(p.id);
  const remove = useDeleteProker(p.id);
  const navigate = useNavigate();
  const edit = useAction();
  const del = useAction();

  return (
    <div className="flex flex-col gap-4">
      <Link to="/proker" className="text-sm text-muted-foreground hover:underline">
        ← Proker
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold tracking-[1.2px] text-muted-foreground">
            {TYPE_LABEL[p.type].toUpperCase()} · {p.department.name.toUpperCase()}
          </span>
          <h1 className="flex flex-wrap items-center gap-3 text-3xl font-bold tracking-tight">
            {p.name} <StatusBadge status={p.status} />
          </h1>
        </div>
        {!editing && (
          <div className="flex gap-2">
            {canEdit && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> Ubah
              </Button>
            )}
            {canDelete && (
              <Button
                variant="destructive"
                aria-label={`Hapus ${p.name}`}
                onClick={() => {
                  if (!window.confirm(`Hapus proker ${p.name}?`)) return;
                  void del
                    .run(
                      () => remove.mutateAsync(undefined),
                      'Proposal proker ini sudah disahkan, jadi tidak bisa dihapus.',
                    )
                    .then((ok) => ok && navigate('/proker'));
                }}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        )}
      </div>
      <ErrorText>{del.error}</ErrorText>

      {editing ? (
        <ProkerForm
          idPrefix="edit-proker"
          submitLabel="Simpan perubahan"
          error={edit.error}
          defaultValues={{
            name: p.name,
            type: p.type,
            eventDate: dayInput(p.eventDate),
            estimatedBudget: p.estimatedBudget,
            description: p.description,
          }}
          onCancel={() => setEditing(false)}
          onSubmit={async (input) => {
            const ok = await edit.run(
              () => update.mutateAsync(input),
              'Nama proker sudah dipakai di departemen ini.',
            );
            if (ok) setEditing(false);
          }}
        />
      ) : (
        <dl className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-4">
          <Fact label="Tanggal acara (H)">{formatDay(p.eventDate)}</Fact>
          <Fact label="Biro pelaksana">{p.biro?.name ?? '—'}</Fact>
          <Fact label="PIC">
            {p.pic ? (
              p.pic.user.name
            ) : (
              <span className="font-semibold text-late-foreground">Perlu PIC</span>
            )}
          </Fact>
          <Fact label="Estimasi anggaran">{formatRupiah(p.estimatedBudget)}</Fact>
          {p.description && (
            <div className="sm:col-span-4">
              <Fact label="Deskripsi">{p.description}</Fact>
            </div>
          )}
          {p.cancelReason && (
            <div className="sm:col-span-4">
              <Fact label="Alasan dibatalkan">{p.cancelReason}</Fact>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium whitespace-pre-line">{children}</dd>
    </div>
  );
}

/** US-3.6: only the next steps of PLANNED → ONGOING → DONE, plus cancel with a reason. */
const NEXT: Record<ProkerStatus, { to: ProkerStatus; label: string }[]> = {
  PLANNED: [{ to: 'ONGOING', label: 'Mulai berjalan' }],
  ONGOING: [{ to: 'DONE', label: 'Tandai selesai' }],
  DONE: [],
  CANCELLED: [],
};

function StatusActions({ proker: p }: { proker: ProkerDetail }) {
  const change = useChangeStatus(p.id);
  const action = useAction();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  if (p.status === 'DONE' || p.status === 'CANCELLED') return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {NEXT[p.status].map((n) => (
          <Button
            key={n.to}
            onClick={() =>
              void action.run(
                () => change.mutateAsync({ status: n.to }),
                'LPJ harus sudah diajukan untuk direview sebelum proker ditandai selesai.',
              )
            }
          >
            {n.label}
          </Button>
        ))}
        {!cancelling && (
          <Button variant="outline" onClick={() => setCancelling(true)}>
            Batalkan proker
          </Button>
        )}
      </div>
      {cancelling && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void action
              .run(() => change.mutateAsync({ status: 'CANCELLED', reason }))
              .then((ok) => ok && setCancelling(false));
          }}
        >
          <div className="min-w-64 flex-1">
            <FormField id="cancel-reason" label="Alasan pembatalan">
              <Input
                id="cancel-reason"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </FormField>
          </div>
          <Button type="submit" variant="destructive" disabled={!reason.trim()}>
            Batalkan
          </Button>
          <Button type="button" variant="outline" onClick={() => setCancelling(false)}>
            Kembali
          </Button>
        </form>
      )}
      <ErrorText>{action.error}</ErrorText>
    </div>
  );
}

/** US-3.2: Dept lead only. Biros come from the department overview, people from the members list. */
function AssignmentSection({ proker: p }: { proker: ProkerDetail }) {
  const overview = useDepartmentOverview(p.department.id);
  const members = useProkerMembers(p.id, true);
  const assign = useAssignProker(p.id);
  const action = useAction();
  const [biroId, setBiroId] = useState(p.biro?.id ?? '');
  const [picId, setPicId] = useState(p.picMembershipId ?? '');
  const changed = biroId !== (p.biro?.id ?? '') || picId !== (p.picMembershipId ?? '');

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void action.run(() =>
          assign.mutateAsync({ biroId: biroId || null, picMembershipId: picId || null }),
        );
      }}
    >
      <h2 className="w-full font-bold">Penugasan</h2>
      {(overview.data?.biros.length ?? 0) > 0 && (
        <div className="min-w-48 flex-1">
          <FormField id="assign-biro" label="Biro pelaksana">
            <select
              id="assign-biro"
              className={selectClass}
              value={biroId}
              onChange={(e) => setBiroId(e.target.value)}
            >
              <option value="">— Belum ditentukan —</option>
              {overview.data?.biros.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      )}
      <div className="min-w-48 flex-1">
        <FormField id="assign-pic" label="PIC">
          <select
            id="assign-pic"
            className={selectClass}
            value={picId}
            onChange={(e) => setPicId(e.target.value)}
          >
            <option value="">— Belum ditentukan —</option>
            {members.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.user.name} · {POSITION_LABEL[m.position]}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <Button type="submit" disabled={!changed}>
        Simpan penugasan
      </Button>
      <div className="w-full">
        <ErrorText>{action.error}</ErrorText>
      </div>
    </form>
  );
}

/** US-3.4: items in due order; overdue ones are flagged, ticked ones show who/when via ✓. */
function ChecklistSection({ proker: p, canTick }: { proker: ProkerDetail; canTick: boolean }) {
  const tick = useTickItem(p.id);
  const action = useAction();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Checklist</h2>
        <ProgressCell progress={p.progress} />
      </div>
      {p.checklist.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Checklist dibuat otomatis setelah tanggal acara diisi.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {p.checklist.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
              <span
                aria-hidden="true"
                className={
                  'grid size-5 shrink-0 place-items-center rounded-full border ' +
                  (item.doneAt ? 'border-success bg-success text-white' : 'border-border')
                }
              >
                {item.doneAt && <Check className="size-3.5" />}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className={item.doneAt ? 'text-muted-foreground line-through' : ''}>
                  {item.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.doneAt
                    ? `Selesai ${formatDay(item.doneAt)}`
                    : `Tenggat ${formatDay(item.dueDate)}`}
                  {item.note && ` · ${item.note}`}
                </span>
              </div>
              {item.overdue && (
                <span className="rounded-full bg-late px-2 py-0.5 text-xs font-semibold text-late-foreground">
                  Terlambat
                </span>
              )}
              {canTick && !item.doneAt && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void action.run(() => tick.mutateAsync(item.key))}
                >
                  Centang
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ErrorText>{action.error}</ErrorText>
    </div>
  );
}

import { zodResolver } from '@hookform/resolvers/zod';
import { Inbox, Pencil, Plus, Search, UserMinus, X } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/features/auth/form-field';
import { cn } from '@/lib/utils';
import {
  useCreateMembership,
  useEndMembership,
  useMemberships,
  useStructure,
  useUpdateMembership,
  useUserSearch,
  type MemberUser,
  type Membership,
  type Placement,
  type Structure,
  orgErrorMessage,
  usePeriodChoice,
} from './org-api';
import { ErrorText, PeriodSelect, selectClass } from './org-forms';
import { POSITION_LABEL, POSITIONS, unitFieldOf, type Position } from './positions';

/** What the side panel holds: nothing, a new membership, or an existing one being changed. */
type Editing = null | 'new' | Membership;

const unitLabel = (m: Membership) =>
  m.biro
    ? `${m.department?.code ?? ''} · ${m.biro.name}`
    : (m.department?.name ??
      m.kesekjenan?.name ??
      (m.coversKesekjenan ? `Mencakup ${m.coversKesekjenan.name}` : '—'));

/** US-2.3 + US-2.4: Admin assigns, changes and ends memberships. */
export function AnggotaPage() {
  const choice = usePeriodChoice();
  const { periodId } = choice;
  const structure = useStructure(periodId);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<{
    q?: string;
    departmentId?: string;
    position?: Position;
  }>({});
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Editing>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const list = useMemberships({ periodId, ...filters, page });
  const end = useEndMembership();

  const filter = (next: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, ...next }));
    setPage(1);
  };

  const endMembership = async (m: Membership) => {
    if (!window.confirm(`Akhiri jabatan ${POSITION_LABEL[m.position]} untuk ${m.user.name}?`))
      return;
    setRowError(null);
    try {
      await end.mutateAsync(m.id);
    } catch (e) {
      setRowError(orgErrorMessage(e, 'Jabatan ini sudah berakhir.'));
    }
  };

  const departments = structure.data?.kesekjenan.flatMap((k) => k.departments) ?? [];
  const meta = list.data?.meta;

  return (
    <div className="flex flex-wrap gap-6">
      <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-3xl font-bold tracking-tight">Anggota &amp; jabatan</h1>
            <p className="text-sm text-muted-foreground">
              {structure.data && `Periode ${structure.data.name}`}
              {meta && ` · ${meta.total} fungsionaris aktif`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PeriodSelect choice={choice} onChange={() => setEditing(null)} />
            <Button size="lg" onClick={() => setEditing('new')}>
              <Plus /> Tambah jabatan
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Search runs on Enter, not on every keystroke, so the list does not refetch per letter. */}
          <form
            role="search"
            className="flex h-9 flex-[1_1_240px] items-center gap-2 rounded-lg border border-input bg-card px-3 text-muted-foreground"
            onSubmit={(e) => {
              e.preventDefault();
              filter({ q: search.trim() || undefined });
            }}
          >
            <Search className="size-4" aria-hidden="true" />
            <input
              type="search"
              aria-label="Cari anggota"
              placeholder="Cari nama, NRP, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
            />
          </form>
          <select
            aria-label="Filter departemen"
            className={cn(selectClass, 'w-auto')}
            value={filters.departmentId ?? ''}
            onChange={(e) => filter({ departmentId: e.target.value || undefined })}
          >
            <option value="">Departemen: Semua</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter jabatan"
            className={cn(selectClass, 'w-auto')}
            value={filters.position ?? ''}
            onChange={(e) =>
              filter({ position: (e.target.value || undefined) as Position | undefined })
            }
          >
            <option value="">Jabatan: Semua</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {POSITION_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
        <ErrorText>{rowError}</ErrorText>

        {list.data?.data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card p-6 text-center">
            <Inbox className="size-7 text-muted-foreground" aria-hidden="true" />
            <span className="font-bold">Belum ada anggota</span>
            <span className="text-[13px] text-muted-foreground">
              {filters.q || filters.departmentId || filters.position
                ? 'Tidak ada yang cocok dengan filter.'
                : 'Tambahkan jabatan pertama untuk periode ini.'}
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-background text-left text-xs tracking-[0.6px] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-bold">NAMA</th>
                  <th className="px-2 py-3 font-bold">NRP</th>
                  <th className="px-2 py-3 font-bold">JABATAN</th>
                  <th className="px-2 py-3 font-bold">UNIT</th>
                  <th className="px-2 py-3">
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.data?.data.map((m) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <span className="flex flex-col">
                        <span className="font-semibold">{m.user.name}</span>
                        <span className="text-xs text-muted-foreground">{m.user.email}</span>
                      </span>
                    </td>
                    <td className="px-2 py-3 font-mono text-[13px]">{m.user.nrp ?? '—'}</td>
                    <td className="px-2 py-3">{POSITION_LABEL[m.position]}</td>
                    <td className="px-2 py-3 text-muted-foreground">{unitLabel(m)}</td>
                    <td className="px-2 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Ubah jabatan ${m.user.name}`}
                          onClick={() => setEditing(m)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Akhiri jabatan ${m.user.name}`}
                          onClick={() => void endMembership(m)}
                        >
                          <UserMinus />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {meta && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-[13px] text-muted-foreground">
                <span>
                  Halaman {meta.page} dari {Math.max(meta.totalPages, 1)} · {meta.total} anggota
                </span>
                <span className="flex gap-1.5">
                  <Button
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Sebelumnya
                  </Button>
                  <Button
                    variant="outline"
                    disabled={page >= meta.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Berikutnya
                  </Button>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {editing && periodId && structure.data && (
        <MembershipPanel
          // A fresh form per membership, so default values never leak from the previous one.
          key={editing === 'new' ? 'new' : editing.id}
          editing={editing}
          periodId={periodId}
          structure={structure.data}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

const placementSchema = z.object({
  position: z.enum(POSITIONS),
  unitId: z.string(),
});
type PlacementValues = z.infer<typeof placementSchema>;

/** The one unit id a membership points at, read back for the edit form. */
function currentUnitId(m: Membership): string {
  return m.biro?.id ?? m.department?.id ?? m.kesekjenan?.id ?? m.coversKesekjenan?.id ?? '';
}

/** Puts the chosen unit id under the field the API expects for that position. */
function toPlacement({ position, unitId }: PlacementValues): Placement {
  switch (unitFieldOf(position)) {
    case 'kesekjenan':
      return { position, kesekjenanId: unitId };
    case 'covers':
      return { position, coversKesekjenanId: unitId };
    case 'department':
    case 'special':
      return { position, departmentId: unitId };
    case 'biro':
      return { position, biroId: unitId };
    case 'none':
      return { position };
  }
}

function MembershipPanel(props: {
  editing: 'new' | Membership;
  periodId: string;
  structure: Structure;
  onClose: () => void;
}) {
  const existing = props.editing === 'new' ? null : props.editing;
  const [user, setUser] = useState<MemberUser | null>(existing?.user ?? null);
  const [serverError, setServerError] = useState<string | null>(null);
  const create = useCreateMembership();
  const update = useUpdateMembership();
  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PlacementValues>({
    resolver: zodResolver(placementSchema),
    defaultValues: {
      position: existing?.position ?? 'STAFF',
      unitId: existing ? currentUnitId(existing) : '',
    },
  });
  const unitField = unitFieldOf(useWatch({ control, name: 'position' }));
  const departments = props.structure.kesekjenan.flatMap((k) => k.departments);

  const onSubmit = handleSubmit(async (values) => {
    if (!user) return setServerError('Pilih pengguna dulu.');
    if (unitField !== 'none' && !values.unitId)
      return setError('unitId', { message: 'Wajib dipilih' });
    setServerError(null);
    try {
      const placement = toPlacement(values);
      if (existing) await update.mutateAsync({ id: existing.id, ...placement });
      else await create.mutateAsync({ ...placement, userId: user.id, periodId: props.periodId });
      props.onClose();
    } catch (e) {
      setServerError(
        orgErrorMessage(
          e,
          'Kursi jabatan ini sudah terisi, atau pengguna sudah punya jabatan aktif di periode ini.',
        ),
      );
    }
  });

  return (
    <aside
      aria-label={existing ? 'Ubah jabatan' : 'Tambah jabatan'}
      className="flex max-w-[400px] flex-[1_1_340px] flex-col gap-4 self-start rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{existing ? 'Ubah jabatan' : 'Tambah jabatan'}</h2>
        <Button variant="ghost" size="icon" aria-label="Tutup" onClick={props.onClose}>
          <X />
        </Button>
      </div>
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="flex flex-col gap-4">
        <ErrorText>{serverError}</ErrorText>
        {existing || user ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
            <span className="flex flex-col">
              <span className="font-semibold">{user?.name}</span>
              <span className="text-xs text-muted-foreground">{user?.nrp ?? user?.email}</span>
            </span>
            {!existing && (
              <Button variant="link" onClick={() => setUser(null)}>
                Ganti
              </Button>
            )}
          </div>
        ) : (
          <UserPicker onPick={setUser} />
        )}

        <FormField id="position" label="Jabatan">
          <select
            id="position"
            className={selectClass}
            // A new position needs a different kind of unit, so the old choice must not be sent.
            {...register('position', { onChange: () => setValue('unitId', '') })}
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {POSITION_LABEL[p]}
              </option>
            ))}
          </select>
        </FormField>

        {(unitField === 'covers' || unitField === 'kesekjenan') && (
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="pb-1.5 font-semibold">
              {unitField === 'covers' ? 'Mencakup kesekjenan' : 'Kesekjenan'}
            </legend>
            {props.structure.kesekjenan.map((k) => (
              <label key={k.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  value={k.id}
                  className="accent-primary"
                  {...register('unitId')}
                />
                {k.name}
              </label>
            ))}
            {errors.unitId && <p className="text-sm text-destructive">{errors.unitId.message}</p>}
          </fieldset>
        )}
        {(unitField === 'department' || unitField === 'special') && (
          <FormField
            id="unit"
            label={unitField === 'special' ? 'Biro khusus' : 'Departemen'}
            error={errors.unitId?.message}
          >
            <select id="unit" className={selectClass} {...register('unitId')}>
              <option value="">Pilih…</option>
              {departments
                .filter((d) => d.kind === (unitField === 'special' ? 'SPECIAL_BIRO' : 'DEPARTMENT'))
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </FormField>
        )}
        {unitField === 'biro' && (
          <FormField id="unit" label="Biro" error={errors.unitId?.message}>
            <select id="unit" className={selectClass} {...register('unitId')}>
              <option value="">Pilih…</option>
              {departments
                .filter((d) => d.biros.length > 0)
                .map((d) => (
                  <optgroup key={d.id} label={d.name}>
                    {d.biros.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
            </select>
          </FormField>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={props.onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            Simpan
          </Button>
        </div>
      </form>
    </aside>
  );
}

/** Search users by name, email or NRP (US-2.3 AC1) and pick one. */
function UserPicker({ onPick }: { onPick: (user: MemberUser) => void }) {
  const [q, setQ] = useState('');
  const results = useUserSearch(q);
  return (
    <FormField
      id="user-search"
      label="Pengguna"
      hint="Ketik minimal 2 huruf nama, email, atau NRP."
    >
      <Input
        id="user-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
      />
      {results.data && (
        <ul className="flex flex-col rounded-lg border border-border">
          {results.data.data.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">Tidak ditemukan.</li>
          )}
          {results.data.data.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => onPick(u)}
                className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <span className="font-semibold">{u.name}</span>
                <span className="text-xs text-muted-foreground">{u.nrp ?? u.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </FormField>
  );
}

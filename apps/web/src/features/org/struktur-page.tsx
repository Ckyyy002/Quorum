import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useActivatePeriod,
  useCreateBiro,
  useCreateDepartment,
  useCreateKesekjenan,
  useCreatePeriod,
  useDeleteBiro,
  useDeleteDepartment,
  useDeleteKesekjenan,
  useDepartmentOverview,
  useStructure,
  useUpdateBiro,
  useUpdateDepartment,
  useUpdateKesekjenan,
  type Kesekjenan,
  type OverviewMember,
  type Structure,
  orgErrorMessage,
  usePeriodChoice,
} from './org-api';
import { ErrorText, PeriodForm, PeriodSelect, UnitForm } from './org-forms';
import { POSITION_LABEL } from './positions';

/** What the right-hand panel shows. */
type Panel =
  | { kind: 'department'; id: string }
  | { kind: 'kesekjenan'; id: string }
  | { kind: 'new-kesekjenan' }
  | { kind: 'new-department'; kesekjenan: Kesekjenan }
  | { kind: 'new-period' }
  | null;

const card = 'rounded-2xl border border-border bg-card';

/** US-2.1 + US-2.2: Admin manages periods, kesekjenan, departments and biros. */
export function StrukturPage() {
  const choice = usePeriodChoice();
  const { periods, periodId } = choice;
  const [panel, setPanel] = useState<Panel>(null);
  const activate = useActivatePeriod();
  const createPeriod = useCreatePeriod();
  const structure = useStructure(periodId);
  const period = periods.data?.find((p) => p.id === periodId);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-bold tracking-tight">Struktur organisasi</h1>
          <p className="text-sm text-muted-foreground">{summary(structure.data)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSelect choice={choice} onChange={() => setPanel(null)} />
          <Button variant="outline" size="lg" onClick={() => setPanel({ kind: 'new-period' })}>
            <Plus /> Periode baru
          </Button>
          {period && !period.isActive && (
            <Button
              size="lg"
              disabled={activate.isPending}
              onClick={() => activate.mutate(period.id)}
            >
              Aktifkan periode
            </Button>
          )}
        </div>
      </div>
      <ErrorText>
        {activate.error && orgErrorMessage(activate.error, 'Periode tidak bisa diaktifkan.')}
      </ErrorText>

      {periods.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Memuat…
        </p>
      ) : periods.data?.length === 0 && panel?.kind !== 'new-period' ? (
        <div className={cn(card, 'border-dashed p-8 text-center')}>
          <p className="font-bold">Belum ada periode</p>
          <p className="text-sm text-muted-foreground">
            Buat periode pertama untuk mulai menyusun struktur.
          </p>
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-5">
          {structure.data && (
            <StructureTree
              structure={structure.data}
              selectedId={
                panel?.kind === 'department' || panel?.kind === 'kesekjenan' ? panel.id : undefined
              }
              onSelect={setPanel}
            />
          )}
          <section className={cn(card, 'p-6 lg:col-span-3')}>
            {panel?.kind === 'new-period' && (
              <>
                <h2 className="mb-4 text-xl font-bold">Periode baru</h2>
                <PeriodForm
                  onCancel={() => setPanel(null)}
                  onSubmit={async (values) => {
                    const created = await createPeriod.mutateAsync(values);
                    choice.setPeriodId(created.id);
                    setPanel(null);
                  }}
                />
              </>
            )}
            {panel?.kind === 'new-kesekjenan' && structure.data && (
              <NewKesekjenan periodId={structure.data.id} onDone={setPanel} />
            )}
            {panel?.kind === 'kesekjenan' && (
              <KesekjenanPanel
                key={panel.id}
                kesekjenan={structure.data?.kesekjenan.find((k) => k.id === panel.id)}
                onDeleted={() => setPanel(null)}
              />
            )}
            {panel?.kind === 'new-department' && (
              <NewDepartment kesekjenan={panel.kesekjenan} onDone={setPanel} />
            )}
            {panel?.kind === 'department' && (
              <DepartmentPanel key={panel.id} id={panel.id} onDeleted={() => setPanel(null)} />
            )}
            {panel === null && (
              <p className="text-sm text-muted-foreground">
                Pilih kesekjenan atau departemen di sebelah kiri untuk mengubahnya, atau tambahkan
                unit baru.
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function summary(s: Structure | undefined): string {
  if (!s) return '';
  const departments = s.kesekjenan.flatMap((k) => k.departments);
  const biros = departments.reduce((n, d) => n + d.biros.length, 0);
  return `Periode ${s.name} · ${s.kesekjenan.length} kesekjenan · ${departments.length} departemen · ${biros} biro`;
}

function StructureTree(props: {
  structure: Structure;
  selectedId: string | undefined;
  onSelect: (panel: Panel) => void;
}) {
  return (
    <section
      aria-label="Pohon struktur"
      className={cn(card, 'flex flex-col gap-3 p-4 text-sm lg:col-span-2')}
    >
      <div className="flex items-center gap-2 px-2 font-bold">
        Periode {props.structure.name}
        {props.structure.isActive && (
          <span className="ml-auto rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold">
            Aktif
          </span>
        )}
      </div>
      {props.structure.kesekjenan.map((k) => (
        <div key={k.id} className="flex flex-col gap-0.5">
          <button
            type="button"
            aria-current={props.selectedId === k.id ? 'true' : undefined}
            onClick={() => props.onSelect({ kind: 'kesekjenan', id: k.id })}
            className={cn(
              'flex min-h-9 items-center gap-2 rounded-lg px-2 py-1 text-left font-semibold hover:bg-accent',
              props.selectedId === k.id && 'bg-accent shadow-[inset_3px_0_0_var(--primary)]',
            )}
          >
            <ChevronDown className="size-4" aria-hidden="true" />
            {k.name}
            <span className="ml-auto font-mono text-xs font-normal text-muted-foreground">
              {k.code}
            </span>
          </button>
          {k.departments.map((d) => (
            <div key={d.id} className="flex flex-col">
              <button
                type="button"
                aria-current={props.selectedId === d.id ? 'true' : undefined}
                onClick={() => props.onSelect({ kind: 'department', id: d.id })}
                className={cn(
                  'flex min-h-9 items-center gap-2 rounded-lg py-1.5 pr-2 pl-8 text-left font-semibold hover:bg-accent',
                  props.selectedId === d.id && 'bg-accent shadow-[inset_3px_0_0_var(--primary)]',
                )}
              >
                {d.name}
                <span className="ml-auto font-mono text-xs font-normal text-muted-foreground">
                  {d.code}
                </span>
              </button>
              {d.biros.map((b) => (
                <span key={b.id} className="py-1 pr-2 pl-14 text-muted-foreground">
                  {b.name}
                </span>
              ))}
            </div>
          ))}
          <button
            type="button"
            onClick={() => props.onSelect({ kind: 'new-department', kesekjenan: k })}
            className="flex min-h-9 items-center gap-2 rounded-lg pl-8 text-left font-semibold text-primary hover:bg-accent"
          >
            <Plus className="size-4" aria-hidden="true" /> Tambah departemen
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => props.onSelect({ kind: 'new-kesekjenan' })}
        className="flex min-h-9 items-center gap-2 rounded-lg px-2 text-left font-semibold text-primary hover:bg-accent"
      >
        <Plus className="size-4" aria-hidden="true" /> Tambah kesekjenan
      </button>
    </section>
  );
}

const KESEKJENAN_CODE_TAKEN = 'Kode kesekjenan sudah dipakai di periode ini.';

function NewKesekjenan({ periodId, onDone }: { periodId: string; onDone: (p: Panel) => void }) {
  const create = useCreateKesekjenan();
  return (
    <>
      <h2 className="mb-4 text-xl font-bold">Tambah kesekjenan</h2>
      <UnitForm
        idPrefix="new-kesekjenan"
        submitLabel="Simpan"
        conflictMessage={KESEKJENAN_CODE_TAKEN}
        onCancel={() => onDone(null)}
        onSubmit={async ({ name, code }) => {
          await create.mutateAsync({ periodId, name, code });
          onDone(null);
        }}
      />
    </>
  );
}

/** Kesekjenan differ per cabinet: the Admin renames them, or deletes one that is still empty. */
function KesekjenanPanel(props: { kesekjenan: Kesekjenan | undefined; onDeleted: () => void }) {
  const update = useUpdateKesekjenan();
  const remove = useDeleteKesekjenan();
  const [editing, setEditing] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const k = props.kesekjenan;
  if (!k) return null;

  const onDelete = async () => {
    if (!window.confirm(`Hapus ${k.name}? Tindakan ini tidak bisa dibatalkan.`)) return;
    setDeleteError(null);
    try {
      await remove.mutateAsync(k.id);
      props.onDeleted();
    } catch (e) {
      setDeleteError(
        orgErrorMessage(
          e,
          'Kesekjenan masih punya departemen, Sekjen (termasuk yang sudah selesai), atau rapat. Kosongkan dulu.',
        ),
      );
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold tracking-[1.2px] text-muted-foreground">
            KESEKJENAN · {k.departments.length} DEPARTEMEN
          </span>
          <h2 className="text-2xl font-bold">
            {k.name} <span className="font-mono text-base text-muted-foreground">({k.code})</span>
          </h2>
        </div>
        {!editing && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil /> Ubah
            </Button>
            <Button
              variant="destructive"
              aria-label={`Hapus ${k.name}`}
              onClick={() => void onDelete()}
            >
              <Trash2 />
            </Button>
          </div>
        )}
      </div>
      <ErrorText>{deleteError}</ErrorText>
      {editing && (
        <UnitForm
          idPrefix="edit-kesekjenan"
          defaultValues={{ name: k.name, code: k.code }}
          submitLabel="Simpan perubahan"
          conflictMessage={KESEKJENAN_CODE_TAKEN}
          onCancel={() => setEditing(false)}
          onSubmit={async ({ name, code }) => {
            await update.mutateAsync({ id: k.id, name, code });
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

function NewDepartment({
  kesekjenan,
  onDone,
}: {
  kesekjenan: Kesekjenan;
  onDone: (p: Panel) => void;
}) {
  const create = useCreateDepartment();
  return (
    <>
      <span className="text-xs font-bold tracking-[1.2px] text-muted-foreground">
        {kesekjenan.name.toUpperCase()}
      </span>
      <h2 className="mb-4 text-xl font-bold">Tambah departemen</h2>
      <UnitForm
        idPrefix="new-dept"
        withKind
        submitLabel="Simpan"
        conflictMessage="Kode departemen sudah dipakai di periode ini."
        onCancel={() => onDone(null)}
        onSubmit={async (values) => {
          const created = await create.mutateAsync({ ...values, kesekjenanId: kesekjenan.id });
          onDone({ kind: 'department', id: created.id });
        }}
      />
    </>
  );
}

/** Lead of a biro: the Kepala Biro if the seat is filled. */
const kabiroOf = (memberships: OverviewMember[]) =>
  memberships.find((m) => m.position === 'KEPALA_BIRO')?.user.name;

function DepartmentPanel({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const overview = useDepartmentOverview(id);
  const update = useUpdateDepartment();
  const remove = useDeleteDepartment();
  const createBiro = useCreateBiro();
  const updateBiro = useUpdateBiro();
  const deleteBiro = useDeleteBiro();
  const [editing, setEditing] = useState(false);
  /** 'new' = the add-biro form; a biro id = that biro's edit form. */
  const [biroForm, setBiroForm] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (overview.isPending)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Memuat…
      </p>
    );
  if (overview.isError) return <ErrorText>{orgErrorMessage(overview.error, '')}</ErrorText>;
  const d = overview.data;
  const isDepartment = d.kind === 'DEPARTMENT';

  const confirmDelete = async (label: string, fn: () => Promise<unknown>, conflict: string) => {
    if (!window.confirm(`Hapus ${label}? Tindakan ini tidak bisa dibatalkan.`)) return;
    setDeleteError(null);
    try {
      await fn();
    } catch (e) {
      setDeleteError(orgErrorMessage(e, conflict));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold tracking-[1.2px] text-muted-foreground">
            {isDepartment ? 'DEPARTEMEN' : 'BIRO KHUSUS'} · {d.kesekjenan.name.toUpperCase()}
          </span>
          <h2 className="text-2xl font-bold">
            {d.name} <span className="font-mono text-base text-muted-foreground">({d.code})</span>
          </h2>
        </div>
        {!editing && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil /> Ubah
            </Button>
            <Button
              variant="destructive"
              aria-label={`Hapus ${d.name}`}
              onClick={() =>
                void confirmDelete(
                  d.name,
                  async () => {
                    await remove.mutateAsync(d.id);
                    onDeleted();
                  },
                  'Departemen masih punya biro, anggota, proker, atau rapat. Kosongkan dulu.',
                )
              }
            >
              <Trash2 />
            </Button>
          </div>
        )}
      </div>
      <ErrorText>{deleteError}</ErrorText>

      {editing && (
        <UnitForm
          idPrefix="edit-dept"
          defaultValues={{ name: d.name, code: d.code }}
          submitLabel="Simpan perubahan"
          conflictMessage="Kode departemen sudah dipakai di periode ini."
          onCancel={() => setEditing(false)}
          onSubmit={async (values) => {
            await update.mutateAsync({ id: d.id, name: values.name, code: values.code });
            setEditing(false);
          }}
        />
      )}

      <div className="flex flex-col gap-2.5">
        <h3 className="font-bold">Pimpinan {isDepartment ? 'departemen' : 'biro'}</h3>
        {d.memberships.length === 0 ? (
          <p className="text-sm font-semibold text-late-foreground">Belum diisi</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {d.memberships.map((m) => (
              <li
                key={m.id}
                className="flex flex-1 basis-56 flex-col rounded-xl border border-border p-3"
              >
                <span className="text-sm font-semibold">{m.user.name}</span>
                <span className="text-[13px] text-muted-foreground">
                  {POSITION_LABEL[m.position]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Special biros (e.g. Biro Personalia) have no biros inside them (US-2.2 AC2). */}
      {isDepartment && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Biro</h3>
            {biroForm === null && (
              <Button variant="link" onClick={() => setBiroForm('new')}>
                <Plus /> Tambah biro
              </Button>
            )}
          </div>
          {biroForm === 'new' && (
            <UnitForm
              idPrefix="new-biro"
              submitLabel="Simpan"
              conflictMessage="Kode biro sudah dipakai di departemen ini."
              onCancel={() => setBiroForm(null)}
              onSubmit={async (values) => {
                await createBiro.mutateAsync({
                  departmentId: d.id,
                  name: values.name,
                  code: values.code,
                });
                setBiroForm(null);
              }}
            />
          )}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-background text-left text-xs tracking-[0.6px] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-bold">BIRO</th>
                  <th className="px-2 py-3 font-bold">KEPALA BIRO</th>
                  <th className="px-2 py-3 font-bold">ANGGOTA</th>
                  <th className="px-2 py-3">
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.biros.length === 0 && (
                  <tr className="border-t border-border">
                    <td colSpan={4} className="px-4 py-3 text-muted-foreground">
                      Belum ada biro.
                    </td>
                  </tr>
                )}
                {d.biros.map((b) =>
                  biroForm === b.id ? (
                    <tr key={b.id} className="border-t border-border">
                      <td colSpan={4} className="p-4">
                        <UnitForm
                          idPrefix={`biro-${b.id}`}
                          defaultValues={{ name: b.name, code: b.code }}
                          submitLabel="Simpan perubahan"
                          conflictMessage="Kode biro sudah dipakai di departemen ini."
                          onCancel={() => setBiroForm(null)}
                          onSubmit={async (values) => {
                            await updateBiro.mutateAsync({
                              id: b.id,
                              name: values.name,
                              code: values.code,
                            });
                            setBiroForm(null);
                          }}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr key={b.id} className="border-t border-border">
                      <td className="px-4 py-3 font-semibold">{b.name}</td>
                      <td className="px-2 py-3">
                        {kabiroOf(b.memberships) ?? (
                          <span className="font-semibold text-late-foreground">Belum diisi</span>
                        )}
                      </td>
                      <td className="px-2 py-3">{b.memberships.length}</td>
                      <td className="px-2 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Ubah ${b.name}`}
                            onClick={() => setBiroForm(b.id)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Hapus ${b.name}`}
                            onClick={() =>
                              void confirmDelete(
                                b.name,
                                () => deleteBiro.mutateAsync(b.id),
                                'Biro masih punya anggota, proker, atau rapat. Kosongkan dulu.',
                              )
                            }
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

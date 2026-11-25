import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorText, selectClass } from '@/features/org/org-forms';
import { ROLE_LABEL } from './labels';
import {
  prokerErrorMessage,
  useProkerMembers,
  useSetCommittee,
  type ProkerDetail,
  type SeatInput,
} from './proker-api';

const ROLES: SeatInput['role'][] = ['SEKBEN', 'KADIV', 'ANGGOTA'];

/**
 * US-3.9. The PIC is always the Ketua Pelaksana (shown, not editable here); the rest of the committee
 * is edited as one list and saved with PUT, which replaces the previous one.
 */
export function CommitteeSection({
  proker: p,
  canEdit,
}: {
  proker: ProkerDetail;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Susunan panitia</h2>
        {canEdit && !editing && (
          <Button variant="outline" onClick={() => setEditing(true)}>
            Atur panitia
          </Button>
        )}
      </div>
      {editing ? (
        <CommitteeEditor proker={p} onDone={() => setEditing(false)} />
      ) : p.committee.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada panitia. Tentukan PIC terlebih dahulu.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {p.committee.map((c) => (
            <li
              key={c.membership.id}
              className="flex flex-1 basis-56 flex-col rounded-xl border border-border bg-card p-3"
            >
              <span className="text-sm font-semibold">{c.membership.user.name}</span>
              <span className="text-[13px] text-muted-foreground">
                {ROLE_LABEL[c.role]}
                {c.divisionName && ` · ${c.divisionName}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CommitteeEditor({ proker: p, onDone }: { proker: ProkerDetail; onDone: () => void }) {
  const members = useProkerMembers(p.id, true);
  const save = useSetCommittee(p.id);
  const [error, setError] = useState<string | null>(null);
  // The PIC row is derived by the API, so the editor holds every other seat.
  const [seats, setSeats] = useState<SeatInput[]>(
    p.committee
      .filter((c) => c.role !== 'KETUA_PELAKSANA')
      .map((c) => ({
        membershipId: c.membership.id,
        role: c.role as SeatInput['role'],
        divisionName: c.divisionName ?? undefined,
      })),
  );
  const candidates = members.data?.filter((m) => m.id !== p.picMembershipId) ?? [];
  const setSeat = (i: number, patch: Partial<SeatInput>) =>
    setSeats((all) => all.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        save
          .mutateAsync(seats.filter((s) => s.membershipId))
          .then(onDone)
          .catch((err: unknown) => setError(prokerErrorMessage(err)));
      }}
    >
      <p className="text-sm text-muted-foreground">
        Ketua Pelaksana: <strong>{p.pic?.user.name ?? 'belum ada PIC'}</strong> (otomatis PIC)
      </p>
      {seats.map((seat, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <select
            aria-label={`Anggota panitia ${i + 1}`}
            className={selectClass}
            value={seat.membershipId}
            onChange={(e) => setSeat(i, { membershipId: e.target.value })}
          >
            <option value="">— Pilih anggota —</option>
            {candidates.map((m) => (
              <option key={m.id} value={m.id}>
                {m.user.name}
                {m.biro && ` · ${m.biro.name}`}
              </option>
            ))}
          </select>
          <select
            aria-label={`Peran ${i + 1}`}
            className={selectClass}
            value={seat.role}
            onChange={(e) => setSeat(i, { role: e.target.value as SeatInput['role'] })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <Input
            aria-label={`Nama divisi ${i + 1}`}
            placeholder={seat.role === 'KADIV' ? 'Nama divisi (wajib)' : 'Hanya untuk Kadiv'}
            disabled={seat.role !== 'KADIV'}
            value={seat.divisionName ?? ''}
            onChange={(e) => setSeat(i, { divisionName: e.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            aria-label={`Hapus baris ${i + 1}`}
            onClick={() => setSeats((all) => all.filter((_, j) => j !== i))}
          >
            <X />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setSeats((all) => [...all, { membershipId: '', role: 'ANGGOTA' }])}
        >
          <Plus /> Tambah anggota
        </Button>
        <Button type="submit" disabled={save.isPending}>
          Simpan panitia
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Batal
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}

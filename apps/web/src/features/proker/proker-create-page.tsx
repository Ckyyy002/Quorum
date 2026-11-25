import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '@/features/auth/auth-context';
import { FormField } from '@/features/auth/form-field';
import { ErrorText, selectClass } from '@/features/org/org-forms';
import { useDepartmentOverview } from '@/features/org/org-api';
import { POSITION_LABEL } from '@/features/org/positions';
import { createsProkerIn } from './permissions';
import { ProkerForm } from './proker-form';
import { prokerErrorMessage, useCreateProker } from './proker-api';

/**
 * US-3.1. The department is the Dept lead's own, or `?departmentId=` from the Biro Personalia card for
 * the Sekjen Personalia. Biro and PIC come from that department's overview.
 */
export function ProkerCreatePage() {
  const { state } = useAuth();
  const [params] = useSearchParams();
  const departmentId =
    params.get('departmentId') ??
    (state.status === 'authenticated' ? createsProkerIn(state.user) : null);
  const overview = useDepartmentOverview(departmentId ?? undefined);
  const create = useCreateProker();
  const navigate = useNavigate();
  const [biroId, setBiroId] = useState('');
  const [picId, setPicId] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!departmentId) {
    return <ErrorText>Hanya pimpinan departemen yang bisa membuat proker.</ErrorText>;
  }
  if (overview.isPending) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Memuat…
      </p>
    );
  }
  if (overview.isError) return <ErrorText>{prokerErrorMessage(overview.error)}</ErrorText>;
  const d = overview.data;
  const members = [...d.memberships, ...d.biros.flatMap((b) => b.memberships)];

  return (
    <section className="flex max-w-3xl flex-col gap-5">
      <div>
        <Link to="/proker" className="text-sm text-muted-foreground hover:underline">
          ← Proker
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Buat proker</h1>
        <p className="text-muted-foreground">{d.name}</p>
      </div>
      <ProkerForm
        idPrefix="new-proker"
        submitLabel="Buat proker"
        error={error}
        onSubmit={async (input) => {
          setError(null);
          try {
            const created = await create.mutateAsync({
              ...input,
              departmentId,
              ...(biroId && { biroId }),
              ...(picId && { picMembershipId: picId }),
            });
            void navigate(`/proker/${created.id}`);
          } catch (e) {
            setError(prokerErrorMessage(e, 'Nama proker sudah dipakai di departemen ini.'));
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {d.biros.length > 0 && (
            <FormField id="new-proker-biro" label="Biro pelaksana">
              <select
                id="new-proker-biro"
                className={selectClass}
                value={biroId}
                onChange={(e) => setBiroId(e.target.value)}
              >
                <option value="">— Belum ditentukan —</option>
                {d.biros.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}
          <FormField id="new-proker-pic" label="PIC" hint="Otomatis menjadi Ketua Pelaksana">
            <select
              id="new-proker-pic"
              className={selectClass}
              value={picId}
              onChange={(e) => setPicId(e.target.value)}
            >
              <option value="">— Belum ditentukan —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.user.name} · {POSITION_LABEL[m.position]}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </ProkerForm>
    </section>
  );
}

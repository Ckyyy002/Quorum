import { useAuth } from '@/features/auth/auth-context';
import { POSITION_LABEL, type Position } from '@/features/org/positions';

// shortcut: greeting only; the "Perlu tindakanmu" dashboard needs proker, tasks and documents (US-3/4/5).
function HomePage() {
  const { state } = useAuth();
  if (state.status !== 'authenticated') return null;
  const { user } = state;
  const m = user.membership;
  const unit = m?.biro?.name ?? m?.department?.name ?? m?.kesekjenan?.name;

  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-3xl font-bold tracking-tight">Halo, {user.name}</h1>
      <p className="text-muted-foreground">
        {m
          ? `${POSITION_LABEL[m.position as Position]}${unit ? ` · ${unit}` : ''} · Periode ${m.period.name}`
          : user.isAdmin
            ? 'Kamu masuk sebagai Admin Sistem. Mulai dari menu Struktur organisasi.'
            : 'Kamu belum punya jabatan di periode aktif. Hubungi Admin Sistem.'}
      </p>
    </section>
  );
}

export default HomePage;

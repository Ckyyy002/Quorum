import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';

// shortcut: placeholder home until the app shell and dashboard land with US-2; replace then.
function HomePage() {
  const { state, logout } = useAuth();
  if (state.status !== 'authenticated') return null;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-8">
      <img src="/logo.svg" alt="Quorum" className="size-12" />
      <h1 className="text-2xl font-semibold">Halo, {state.user.name}</h1>
      <p className="text-muted-foreground">
        Kamu sudah masuk sebagai {state.user.email}. Dashboard menyusul setelah struktur organisasi
        dibuat.
      </p>
      <Button variant="outline" className="self-start" onClick={() => void logout()}>
        Keluar
      </Button>
    </main>
  );
}

export default HomePage;

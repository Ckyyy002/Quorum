import { ShieldAlert } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './auth-context';

function FullPageSpinner() {
  return (
    <div className="grid min-h-svh place-items-center text-sm text-muted-foreground" role="status">
      Memuat…
    </div>
  );
}

/** Routes for logged-in users. Only hides screens; the API still checks every request. */
export function RequireAuth() {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'loading') return <FullPageSpinner />;
  if (state.status === 'anonymous')
    return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

/**
 * Login and register: a logged-in user is sent to the app instead. Right after logging in this is what moves
 * the user on, so it goes back to the page RequireAuth sent them from, with its query (the QR check-in link
 * carries its token there).
 */
export function GuestOnly() {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === 'loading') return <FullPageSpinner />;
  if (state.status === 'authenticated') {
    const from = (location.state as { from?: { pathname: string; search: string } } | null)?.from;
    return <Navigate to={from ? from.pathname + from.search : '/'} replace />;
  }
  return <Outlet />;
}

/** Admin screens. Non-admins see a 403 state instead of a redirect, so they know why (US-2 mockup). */
export function RequireAdmin() {
  const { state } = useAuth();
  if (state.status === 'authenticated' && !state.user.isAdmin) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <ShieldAlert className="size-7 text-destructive" aria-hidden="true" />
        <h1 className="font-bold">Kamu tidak punya akses</h1>
        <p className="text-sm text-muted-foreground">Halaman ini hanya untuk Admin Sistem.</p>
      </div>
    );
  }
  return <Outlet />;
}

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

/** Login and register: a logged-in user is sent to the app instead. */
export function GuestOnly() {
  const { state } = useAuth();
  if (state.status === 'loading') return <FullPageSpinner />;
  if (state.status === 'authenticated') return <Navigate to="/" replace />;
  return <Outlet />;
}

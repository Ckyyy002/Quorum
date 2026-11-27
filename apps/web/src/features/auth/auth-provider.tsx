import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { refreshAccessToken, setAccessToken, setSessionExpiredHandler } from '@/lib/api';
import { fetchMe, loginRequest, logoutRequest, type Me } from './auth-api';
import { AuthContext, type AuthState } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    setSessionExpiredHandler(() => setState({ status: 'anonymous' }));

    // On page load the in-memory token is gone; the refresh cookie restores the session if it is still valid.
    let cancelled = false;
    refreshAccessToken()
      .then(fetchMe)
      .then((user) => !cancelled && setState({ status: 'authenticated', user }))
      .catch(() => !cancelled && setState({ status: 'anonymous' }));
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setAccessToken(await loginRequest(email, password));
    setState({ status: 'authenticated', user: await fetchMe() });
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      // Forget the session locally even if the request failed; the cookie expires on its own.
      setAccessToken(null);
      setState({ status: 'anonymous' });
    }
  }, []);

  const setUser = useCallback((user: Me) => setState({ status: 'authenticated', user }), []);

  const value = useMemo(() => ({ state, login, logout, setUser }), [state, login, logout, setUser]);
  return <AuthContext value={value}>{children}</AuthContext>;
}

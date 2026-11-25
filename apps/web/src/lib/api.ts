import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

/** Single HTTP client. `/api` is proxied to the API by Vite, so the refresh cookie is same-origin. */
export const api = axios.create({ baseURL: '/api/v1', withCredentials: true });

// The access token lives only in memory (never localStorage), so an XSS payload cannot read it
// from storage, and a page reload gets a new one through the httpOnly refresh cookie.
let accessToken: string | null = null;
let onSessionExpired: () => void = () => {};

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Called once by AuthProvider: what to do when a refresh fails (clear state, go to /login). */
export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

// Concurrent callers (several 401s at once, or React StrictMode running the startup effect twice)
// share one request: a second refresh with the already-rotated cookie would look like token reuse
// to the API, which then revokes the whole session.
let refreshing: Promise<string> | null = null;

/** Asks the API for a new access token using the refresh cookie. */
export function refreshAccessToken(): Promise<string> {
  refreshing ??= api
    .post<{ accessToken: string }>('/auth/refresh')
    .then((res) => {
      setAccessToken(res.data.accessToken);
      return res.data.accessToken;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const config = error.config as RetriableConfig | undefined;
  const isAuthCall = config?.url?.startsWith('/auth/') ?? false;
  if (error.response?.status !== 401 || !config || config._retried || isAuthCall) {
    throw error;
  }

  config._retried = true;
  try {
    const token = await refreshAccessToken();
    config.headers.Authorization = `Bearer ${token}`;
    return api(config);
  } catch {
    setAccessToken(null);
    onSessionExpired();
    throw error;
  }
});

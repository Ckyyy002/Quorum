import { isAxiosError } from 'axios';
import { api } from '@/lib/api';

export interface User {
  id: string;
  email: string;
  name: string;
  nrp: string | null;
  avatarPath: string | null;
  isAdmin: boolean;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  nrp?: string;
}

export async function loginRequest(email: string, password: string): Promise<string> {
  const res = await api.post<{ accessToken: string }>('/auth/login', { email, password });
  return res.data.accessToken;
}

export async function registerRequest(input: RegisterInput): Promise<User> {
  return (await api.post<User>('/auth/register', input)).data;
}

export async function logoutRequest(): Promise<void> {
  await api.post('/auth/logout');
}

export async function fetchMe(): Promise<User> {
  return (await api.get<User>('/me')).data;
}

/** Indonesian message for the user; the API's own messages are English and meant for developers. */
export function authErrorMessage(error: unknown, statusMessages: Record<number, string>): string {
  if (isAxiosError(error)) {
    if (!error.response) return 'Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi.';
    const known = statusMessages[error.response.status];
    if (known) return known;
  }
  return 'Terjadi kesalahan. Coba lagi beberapa saat lagi.';
}

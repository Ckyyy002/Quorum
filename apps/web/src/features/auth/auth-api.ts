import { api } from '@/lib/api';

export interface User {
  id: string;
  email: string;
  name: string;
  nrp: string | null;
  /** Set when the user uploaded a picture; fetch it from /users/:id/avatar. */
  avatarFileId: string | null;
  isAdmin: boolean;
}

/** Active membership from `GET /me`; null when the user holds no position in the active period. */
export interface MyMembership {
  id: string;
  position: string;
  roleGroup: string;
  period: { id: string; name: string };
  kesekjenan: { id: string; code: string; name: string } | null;
  department: { id: string; name: string; code: string } | null;
  biro: { id: string; name: string; code: string } | null;
  /** Sekjen Adm/Keu only: the kesekjenan whose documents they review. */
  coversKesekjenan: { id: string; code: string; name: string } | null;
}

export interface Me extends User {
  membership: MyMembership | null;
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

export async function fetchMe(): Promise<Me> {
  return (await api.get<Me>('/me')).data;
}

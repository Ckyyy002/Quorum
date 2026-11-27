import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/auth-context';
import type { Me } from '@/features/auth/auth-api';
import { api, errorMessage } from '@/lib/api';

// Same limits as apps/api/src/upload/domain/upload-rules.ts (AVATAR_FILES); the API checks the content again.
export const AVATAR_ACCEPT = '.jpg,.jpeg,.png,.webp';
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** Both calls answer with the fresh `/me`, which replaces the signed-in user (header name and picture). */
function useProfileMutation<T>(fn: (input: T) => Promise<{ data: Me }>) {
  const { setUser } = useAuth();
  return useMutation({
    mutationFn: async (input: T) => (await fn(input)).data,
    onSuccess: setUser,
  });
}

export const useUpdateProfile = () =>
  useProfileMutation((input: { name: string; nrp: string | null }) => api.patch<Me>('/me', input));

export const useUploadAvatar = () =>
  useProfileMutation((file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.put<Me>('/me/avatar', form);
  });

/**
 * The picture needs the access token, which an <img src> cannot send, so it is fetched as a blob. The file id
 * is part of the key: a new upload gets a new id, so the old picture is never shown from cache.
 * shortcut: object URLs are never revoked (one small blob per picture per session); revoke them if avatars
 * appear in long member lists.
 */
export function useAvatarUrl(userId: string, fileId: string | null) {
  return useQuery({
    queryKey: ['avatar', userId, fileId],
    queryFn: async () =>
      URL.createObjectURL(
        (await api.get<Blob>(`/users/${userId}/avatar`, { responseType: 'blob' })).data,
      ),
    enabled: !!fileId,
    staleTime: Infinity,
  }).data;
}

export function profileErrorMessage(error: unknown): string {
  return errorMessage(error, {
    400: 'Data tidak valid. Foto harus JPG, PNG, atau WebP; NRP 10 digit.',
    409: 'NRP ini sudah dipakai akun lain.',
    413: 'Ukuran foto maksimal 2 MB.',
  });
}

import { zodResolver } from '@hookform/resolvers/zod';
import { Camera } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Me } from '@/features/auth/auth-api';
import { useAuth } from '@/features/auth/auth-context';
import { FormField } from '@/features/auth/form-field';
import { ErrorText } from '@/features/org/org-forms';
import { Avatar } from './avatar';
import {
  AVATAR_ACCEPT,
  MAX_AVATAR_BYTES,
  profileErrorMessage,
  useUpdateProfile,
  useUploadAvatar,
} from './profile-api';

// Same rules as the API DTO (apps/api/src/users/dto/update-me.dto.ts).
const schema = z.object({
  name: z.string().trim().min(2, 'Minimal 2 karakter').max(100, 'Maksimal 100 karakter'),
  nrp: z
    .string()
    .trim()
    .regex(/^(\d{10})?$/, 'NRP harus 10 digit'),
});
type Values = z.infer<typeof schema>;

/** US-1.5: name, NRP and picture. The email is the login, so it is shown but not editable. */
export function ProfilePage() {
  const { state } = useAuth();
  if (state.status !== 'authenticated') return null;
  return (
    <section className="flex max-w-xl flex-col gap-6">
      <h1 className="text-3xl font-bold tracking-tight">Profil</h1>
      <AvatarPicker user={state.user} />
      <ProfileForm user={state.user} />
    </section>
  );
}

function AvatarPicker({ user }: { user: Me }) {
  const upload = useUploadAvatar();
  const [error, setError] = useState<string | null>(null);

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) return setError('Ukuran foto maksimal 2 MB.');
    setError(null);
    upload.mutateAsync(file).catch((e: unknown) => setError(profileErrorMessage(e)));
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar user={user} className="size-20 text-2xl" />
      <div className="flex flex-col gap-1">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-primary hover:underline">
          <Camera className="size-4" aria-hidden="true" />
          {upload.isPending ? 'Mengunggah…' : user.avatarFileId ? 'Ganti foto' : 'Unggah foto'}
          <input
            type="file"
            accept={AVATAR_ACCEPT}
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0])}
          />
        </label>
        <span className="text-xs text-muted-foreground">JPG, PNG, atau WebP · maks 2 MB</span>
        <ErrorText>{error}</ErrorText>
      </div>
    </div>
  );
}

function ProfileForm({ user }: { user: Me }) {
  const update = useUpdateProfile();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: user.name, nrp: user.nrp ?? '' },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5"
      onSubmit={(e) =>
        void handleSubmit(async (v) => {
          setError(null);
          setSaved(false);
          try {
            // An empty NRP field removes it.
            await update.mutateAsync({ name: v.name, nrp: v.nrp || null });
            setSaved(true);
          } catch (err) {
            setError(profileErrorMessage(err));
          }
        })(e)
      }
    >
      <FormField
        id="profile-email"
        label="Email"
        hint="Email dipakai untuk masuk dan tidak bisa diubah."
      >
        <Input id="profile-email" value={user.email} disabled readOnly />
      </FormField>
      <FormField id="profile-name" label="Nama" error={errors.name?.message}>
        <Input id="profile-name" aria-invalid={!!errors.name} {...register('name')} />
      </FormField>
      <FormField id="profile-nrp" label="NRP" error={errors.nrp?.message}>
        <Input
          id="profile-nrp"
          inputMode="numeric"
          aria-invalid={!!errors.nrp}
          {...register('nrp')}
        />
      </FormField>
      <ErrorText>{error}</ErrorText>
      {saved && (
        <p role="status" className="text-sm text-success">
          Profil tersimpan.
        </p>
      )}
      <Button type="submit" className="self-start" disabled={isSubmitting}>
        {isSubmitting ? 'Menyimpan…' : 'Simpan'}
      </Button>
    </form>
  );
}

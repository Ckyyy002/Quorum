import { zodResolver } from '@hookform/resolvers/zod';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useSearchParams } from 'react-router';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/api';
import { forgotPasswordRequest, resetPasswordRequest } from './auth-api';
import { AuthLayout } from './auth-layout';
import { FormField } from './form-field';
import { passwordSchema } from './password-schema';

function Heading({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function Alert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  );
}

const BackToLogin = () => (
  <Link to="/login" className="text-center text-sm font-semibold text-primary hover:underline">
    Kembali ke halaman masuk
  </Link>
);

const forgotSchema = z.object({ email: z.email('Masukkan email yang valid') });

/** US-1.6: asks for the email; the answer is the same whether or not it is registered. */
export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) });

  if (sent) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-5">
          <Heading
            title="Cek email-mu"
            text="Kalau email itu terdaftar, link untuk mengatur ulang password sudah dikirim. Link berlaku 30 menit dan hanya bisa dipakai sekali."
          />
          <BackToLogin />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(e) =>
          void handleSubmit(async ({ email }) => {
            setServerError(null);
            try {
              await forgotPasswordRequest(email);
              setSent(true);
            } catch (error) {
              setServerError(errorMessage(error, {}));
            }
          })(e)
        }
      >
        <Heading
          title="Lupa password"
          text="Masukkan email akunmu. Kami kirim link untuk membuat password baru."
        />
        {serverError && <Alert>{serverError}</Alert>}
        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="nama@student.its.ac.id"
            className="h-11"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
        </FormField>
        <Button type="submit" className="h-11 text-base" disabled={isSubmitting}>
          {isSubmitting ? 'Mengirim…' : 'Kirim link'}
        </Button>
        <BackToLogin />
      </form>
    </AuthLayout>
  );
}

const resetSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Password tidak sama',
  });

/** US-1.6: the page the emailed link opens (`/reset-password?token=…`). */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });

  if (!token || done) {
    return (
      <AuthLayout>
        <div className="flex flex-col gap-5">
          {done ? (
            <Heading
              title="Password diperbarui"
              text="Masuk dengan password barumu. Semua perangkat lain sudah dikeluarkan."
            />
          ) : (
            <Heading
              title="Link tidak lengkap"
              text="Buka link dari email apa adanya, atau minta link baru."
            />
          )}
          {!done && (
            <Link
              to="/lupa-password"
              className="text-center text-sm font-semibold text-primary hover:underline"
            >
              Minta link baru
            </Link>
          )}
          <BackToLogin />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form
        noValidate
        className="flex flex-col gap-5"
        onSubmit={(e) =>
          void handleSubmit(async ({ password }) => {
            setServerError(null);
            try {
              await resetPasswordRequest(token, password);
              setDone(true);
            } catch (error) {
              setServerError(
                errorMessage(error, {
                  400: 'Link sudah tidak berlaku (kedaluwarsa atau sudah dipakai). Minta link baru.',
                }),
              );
            }
          })(e)
        }
      >
        <Heading
          title="Buat password baru"
          text="Minimal 8 karakter, dengan huruf besar, huruf kecil dan angka."
        />
        {serverError && (
          <Alert>
            {serverError}{' '}
            <Link to="/lupa-password" className="font-semibold underline">
              Minta link baru
            </Link>
          </Alert>
        )}
        <FormField id="password" label="Password baru" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            className="h-11"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
        </FormField>
        <FormField id="confirm" label="Ulangi password" error={errors.confirm?.message}>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            className="h-11"
            aria-invalid={!!errors.confirm}
            {...register('confirm')}
          />
        </FormField>
        <Button type="submit" className="h-11 text-base" disabled={isSubmitting}>
          {isSubmitting ? 'Menyimpan…' : 'Simpan password'}
        </Button>
      </form>
    </AuthLayout>
  );
}

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/api';
import { useAuth } from './auth-context';
import { AuthLayout } from './auth-layout';
import { FormField } from './form-field';

const loginSchema = z.object({
  email: z.email('Masukkan email yang valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});
type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setServerError(null);
    try {
      // GuestOnly moves the user on (back to where they came from) once the state is authenticated.
      await login(email, password);
    } catch (error) {
      setServerError(errorMessage(error, { 401: 'Email atau password salah.' }));
    }
  });

  return (
    <AuthLayout>
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl font-bold tracking-tight">Masuk ke Quorum</h2>
          <p className="text-sm text-muted-foreground">
            Gunakan email yang terdaftar di kepengurusan.
          </p>
        </div>

        {serverError && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {serverError}
          </p>
        )}

        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="nama@student.its.ac.id"
            className="h-11"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
          />
        </FormField>

        <FormField id="password" label="Password" error={errors.password?.message}>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="h-11 pr-11"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-1.5 right-1.5"
              aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </Button>
          </div>
        </FormField>

        <Link to="/lupa-password" className="-mt-2 self-end text-sm text-primary hover:underline">
          Lupa password?
        </Link>

        <Button type="submit" className="h-11 text-base" disabled={isSubmitting}>
          {isSubmitting ? 'Memproses…' : 'Masuk'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Belum punya akun?{' '}
          <Link to="/register" className="font-semibold text-primary hover:underline">
            Daftar
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

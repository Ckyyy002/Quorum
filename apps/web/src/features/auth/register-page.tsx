import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/api';
import { registerRequest } from './auth-api';
import { useAuth } from './auth-context';
import { AuthLayout } from './auth-layout';
import { FormField } from './form-field';

// Mirrors RegisterDto on the API, so most mistakes are caught before the request; the API still validates.
const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100, 'Nama maksimal 100 karakter'),
  email: z.email('Masukkan email yang valid'),
  nrp: z
    .string()
    .trim()
    .regex(/^(\d{10})?$/, 'NRP harus 10 digit angka'),
  password: z
    .string()
    .min(8, 'Password minimal 8 karakter')
    .max(128, 'Password maksimal 128 karakter')
    .regex(/[A-Z]/, 'Password harus mengandung huruf besar')
    .regex(/[a-z]/, 'Password harus mengandung huruf kecil')
    .regex(/\d/, 'Password harus mengandung angka'),
});
type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await registerRequest({ ...values, nrp: values.nrp || undefined });
      // Log straight in: the new user starts as a Guest until Admin assigns a position.
      await login(values.email, values.password);
      await navigate('/', { replace: true });
    } catch (error) {
      setServerError(
        errorMessage(error, {
          409: 'Email atau NRP sudah terdaftar. Silakan masuk.',
          400: 'Data belum valid. Periksa kembali isian kamu.',
        }),
      );
    }
  });

  const field = (name: keyof RegisterValues) => ({
    'aria-invalid': !!errors[name],
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
  });

  return (
    <AuthLayout>
      <form onSubmit={(e) => void onSubmit(e)} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl font-bold tracking-tight">Buat akun</h2>
          <p className="text-sm text-muted-foreground">
            Setelah mendaftar, Admin akan menempatkanmu pada jabatan di kepengurusan.
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

        <FormField id="name" label="Nama lengkap" error={errors.name?.message}>
          <Input
            id="name"
            autoComplete="name"
            className="h-11"
            {...field('name')}
            {...register('name')}
          />
        </FormField>

        <FormField id="email" label="Email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="nama@student.its.ac.id"
            className="h-11"
            {...field('email')}
            {...register('email')}
          />
        </FormField>

        <FormField id="nrp" label="NRP (opsional)" error={errors.nrp?.message}>
          <Input
            id="nrp"
            inputMode="numeric"
            placeholder="5025231001"
            className="h-11 font-mono"
            {...field('nrp')}
            {...register('nrp')}
          />
        </FormField>

        <FormField
          id="password"
          label="Password"
          error={errors.password?.message}
          hint="Minimal 8 karakter, dengan huruf besar, huruf kecil, dan angka."
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            className="h-11"
            {...field('password')}
            aria-describedby={errors.password ? 'password-error' : 'password-hint'}
            {...register('password')}
          />
        </FormField>

        <Button type="submit" className="h-11 text-base" disabled={isSubmitting}>
          {isSubmitting ? 'Memproses…' : 'Daftar'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Sudah punya akun?{' '}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Masuk
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

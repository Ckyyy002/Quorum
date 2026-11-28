import { z } from 'zod';

/** RegisterDto's password rules; the reset page uses the same ones. */
export const passwordSchema = z
  .string()
  .min(8, 'Password minimal 8 karakter')
  .max(128, 'Password maksimal 128 karakter')
  .regex(/[A-Z]/, 'Password harus mengandung huruf besar')
  .regex(/[a-z]/, 'Password harus mengandung huruf kecil')
  .regex(/\d/, 'Password harus mengandung angka');

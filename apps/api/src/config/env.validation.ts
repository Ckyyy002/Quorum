import { plainToInstance, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, MinLength, validateSync } from 'class-validator';

class Env {
  @IsString()
  DATABASE_URL!: string;

  /** HS256 signing key for access tokens; 32+ chars (e.g. `openssl rand -hex 32`). */
  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  /** Where uploaded files are written, relative to the API folder (rule 8: apps/api/uploads). */
  @IsOptional()
  @IsString()
  UPLOAD_DIR: string = 'uploads';
}

/** Fails fast at startup instead of at the first request when a required variable is missing. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const env = plainToInstance(Env, raw);
  const errors = validateSync(env);
  if (errors.length > 0) {
    throw new Error(`Invalid environment: ${errors.map((e) => e.property).join(', ')}`);
  }
  return env;
}

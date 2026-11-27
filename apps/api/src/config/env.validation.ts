import { plainToInstance, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

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

  /** `smtp` sends through SMTP_HOST:SMTP_PORT (Mailpit in dev); `json` only builds the message (tests). */
  @IsOptional()
  @IsIn(['smtp', 'json'])
  MAIL_TRANSPORT: 'smtp' | 'json' = 'smtp';

  @IsOptional()
  @IsString()
  SMTP_HOST: string = 'localhost';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  SMTP_PORT: number = 1025;

  @IsOptional()
  @IsString()
  MAIL_FROM: string = 'Quorum HMTC <no-reply@quorum.test>';

  /** The web app's address, for links in emails. */
  @IsOptional()
  @IsString()
  WEB_URL: string = 'http://localhost:5173';
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

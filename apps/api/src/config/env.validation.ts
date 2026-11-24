import { plainToInstance, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

class Env {
  @IsString()
  DATABASE_URL!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;
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

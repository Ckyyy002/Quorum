import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const base = { DATABASE_URL: 'postgresql://x', JWT_ACCESS_SECRET: 'a'.repeat(32) };

  it('accepts a valid environment and converts PORT to a number', () => {
    const env = validateEnv({ ...base, PORT: '4000' });

    expect(env.PORT).toBe(4000);
  });

  it('defaults PORT to 3000', () => {
    expect(validateEnv(base).PORT).toBe(3000);
  });

  it('names the missing variable when DATABASE_URL is absent', () => {
    expect(() => validateEnv({ JWT_ACCESS_SECRET: base.JWT_ACCESS_SECRET })).toThrow(
      'DATABASE_URL',
    );
  });

  it('rejects a JWT secret shorter than 32 characters', () => {
    expect(() => validateEnv({ ...base, JWT_ACCESS_SECRET: 'too-short' })).toThrow(
      'JWT_ACCESS_SECRET',
    );
  });
});

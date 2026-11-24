import { validateEnv } from './env.validation.js';

describe('validateEnv', () => {
  it('accepts a valid environment and converts PORT to a number', () => {
    const env = validateEnv({ DATABASE_URL: 'postgresql://x', PORT: '4000' });

    expect(env.PORT).toBe(4000);
  });

  it('defaults PORT to 3000', () => {
    expect(validateEnv({ DATABASE_URL: 'postgresql://x' }).PORT).toBe(3000);
  });

  it('names the missing variable when DATABASE_URL is absent', () => {
    expect(() => validateEnv({})).toThrow('DATABASE_URL');
  });
});

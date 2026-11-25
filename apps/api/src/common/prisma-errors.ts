import { Prisma } from '../generated/prisma/client';

/** True for a unique-constraint violation (P2002). Repositories use it to turn races into a clean 409. */
export function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

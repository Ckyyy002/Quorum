import type { Prisma, User } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/prisma/prisma.service';

let sequence = 0;

/** Creates a user with unique email and NRP; pass overrides for the fields a test cares about. */
export async function createUser(
  prisma: PrismaService,
  overrides: Partial<Prisma.UserCreateInput> = {},
): Promise<User> {
  sequence += 1;
  return prisma.user.create({
    data: {
      email: `user${sequence}@student.its.ac.id`,
      name: `User ${sequence}`,
      nrp: String(5025240000 + sequence),
      // shortcut: placeholder hash, no login possible; US-1 replaces it with a real argon2 hash of a known password.
      passwordHash: 'not-a-real-hash',
      ...overrides,
    },
  });
}

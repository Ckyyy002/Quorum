import type { PrismaService } from '../prisma/prisma.service';
import { UsersRepository } from './users.repository';

/** The duplicate-NRP path is covered by test/profile.e2e-spec.ts; this is the other database error. */
describe('UsersRepository.update', () => {
  it('passes on database errors other than a duplicate NRP', async () => {
    const failure = new Error('connection lost');
    const prisma = { user: { update: jest.fn().mockRejectedValue(failure) } };
    const repo = new UsersRepository(prisma as unknown as PrismaService);

    await expect(repo.update('u1', { name: 'Raka' })).rejects.toBe(failure);
  });
});

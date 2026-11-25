import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup-app';
import { resetDatabase } from './database';
import { createUser } from './factories';

// Checks the constraints that live only in the init migration's raw SQL (partial unique indexes).
describe('Database constraints (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await app.close();
  });

  const period = (name: string, isActive: boolean) => ({
    name,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    isActive,
  });

  it('empties every table on reset', async () => {
    // Arrange
    await createUser(prisma);

    // Act
    await resetDatabase(prisma);

    // Assert
    expect(await prisma.user.count()).toBe(0);
  });

  it('allows only one active period', async () => {
    await prisma.period.create({ data: period('2026/2027', true) });

    await expect(prisma.period.create({ data: period('2027/2028', true) })).rejects.toThrow();
    await expect(prisma.period.create({ data: period('2025/2026', false) })).resolves.toBeDefined();
  });

  it('allows one active membership per user per period, but a new one after the old one ends', async () => {
    // Arrange
    const user = await createUser(prisma);
    const { id: periodId } = await prisma.period.create({ data: period('2026/2027', true) });
    const first = await prisma.membership.create({
      data: { userId: user.id, periodId, position: 'KETUA' },
    });

    // Act + Assert: a second active membership is rejected
    await expect(
      prisma.membership.create({ data: { userId: user.id, periodId, position: 'STAFF' } }),
    ).rejects.toThrow();

    // Ending the first one frees the slot
    await prisma.membership.update({ where: { id: first.id }, data: { endedAt: new Date() } });
    await expect(
      prisma.membership.create({ data: { userId: user.id, periodId, position: 'STAFF' } }),
    ).resolves.toBeDefined();
  });
});

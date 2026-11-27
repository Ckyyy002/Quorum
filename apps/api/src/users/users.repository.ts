import { Injectable } from '@nestjs/common';
import { isUniqueViolation } from '../common/prisma-errors';
import type { Prisma, User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** A user as it may leave the API: everything except the password hash. */
export type PublicUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<PublicUser | null> {
    return this.prisma.user.findUnique({ where: { id }, omit: { passwordHash: true } });
  }

  /** Admin user picker (US-2.3 AC1): name, email or NRP, paginated. */
  async search(q: string | undefined, page: { skip: number; take: number }) {
    const where: Prisma.UserWhereInput = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { nrp: { contains: q } },
          ],
        }
      : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        omit: { passwordHash: true },
        orderBy: { name: 'asc' },
        ...page,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data, total };
  }

  /** US-1.5 AC1. Null when the NRP is already taken (the unique index decides, so races are safe). */
  async update(
    id: string,
    data: { name?: string; nrp?: string | null; avatarFileId?: string },
  ): Promise<PublicUser | null> {
    try {
      return await this.prisma.user.update({ where: { id }, data, omit: { passwordHash: true } });
    } catch (e) {
      if (isUniqueViolation(e)) return null;
      throw e;
    }
  }

  /** Seed only: creates the admin, or promotes an existing account without touching its password. */
  upsertAdmin(data: { email: string; name: string; passwordHash: string }): Promise<PublicUser> {
    return this.prisma.user.upsert({
      where: { email: data.email },
      create: { ...data, isAdmin: true },
      update: { isAdmin: true },
      omit: { passwordHash: true },
    });
  }

  /** Includes the hash: only the login flow calls this. */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /** Returns null when the email (or NRP) is already taken; the unique index decides, so races are safe. */
  async create(data: Prisma.UserCreateInput): Promise<PublicUser | null> {
    try {
      return await this.prisma.user.create({ data, omit: { passwordHash: true } });
    } catch (e) {
      if (isUniqueViolation(e)) return null;
      throw e;
    }
  }
}

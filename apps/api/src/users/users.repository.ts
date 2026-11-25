import { Injectable } from '@nestjs/common';
import { Prisma, type User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** A user as it may leave the API: everything except the password hash. */
export type PublicUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<PublicUser | null> {
    return this.prisma.user.findUnique({ where: { id }, omit: { passwordHash: true } });
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
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return null;
      throw e;
    }
  }
}

import { Injectable } from '@nestjs/common';
import type { RefreshToken } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface NewRefreshToken {
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: NewRefreshToken): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  /** Revokes the old token and stores its successor atomically, so a crash cannot leave two live tokens. */
  async rotate(oldId: string, next: NewRefreshToken): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({ where: { id: oldId }, data: { revokedAt: new Date() } }),
      this.prisma.refreshToken.create({ data: next }),
    ]);
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PasswordResetRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** A new link kills every older unused one, so only the latest email works. */
  async replace(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: now },
      }),
      this.prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } }),
    ]);
  }

  findByHash(tokenHash: string) {
    return this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  /**
   * Uses the token, sets the new password and revokes every refresh token (US-1.6 AC1), all or nothing.
   * The token update only matches while it is unused, so two requests with one link cannot both succeed;
   * false means this one lost.
   */
  async reset(tokenId: string, userId: string, passwordHash: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const { count } = await tx.passwordResetToken.updateMany({
        where: { id: tokenId, usedAt: null },
        data: { usedAt: now },
      });
      if (count === 0) return false;
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      });
      return true;
    });
  }
}

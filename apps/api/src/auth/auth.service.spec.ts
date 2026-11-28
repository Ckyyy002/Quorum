import { BadRequestException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { JwtService } from '@nestjs/jwt';
import type { UsersRepository } from '../users/users.repository';
import { AuthService } from './auth.service';
import type { PasswordResetRepository } from './password-reset.repository';
import type { RefreshTokenRepository } from './refresh-token.repository';

/** The race the e2e tests cannot trigger on demand; the rest of auth is covered end to end. */
describe('AuthService', () => {
  it('answers 400 when another request used the reset link between the check and the write', async () => {
    // Arrange: the token looks unused, but the conditional update matches no row.
    const resets = {
      findByHash: jest.fn().mockResolvedValue({
        id: 't',
        userId: 'u',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      }),
      reset: jest.fn().mockResolvedValue(false),
    };
    const service = new AuthService(
      {} as UsersRepository,
      {} as RefreshTokenRepository,
      resets as unknown as PasswordResetRepository,
      {} as JwtService,
      {} as EventEmitter2,
    );

    // Act
    const result = service.resetPassword({ token: 'raw', password: 'BaruLagi456' });

    // Assert
    await expect(result).rejects.toBeInstanceOf(BadRequestException);
  });
});

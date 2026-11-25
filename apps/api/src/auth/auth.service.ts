import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { type PublicUser, UsersRepository } from '../users/users.repository';
import {
  classifyRefreshToken,
  generateRefreshToken,
  hashRefreshToken,
  REFRESH_TOKEN_TTL_MS,
} from './domain/refresh-token';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { RefreshTokenRepository } from './refresh-token.repository';

export interface IssuedTokens {
  accessToken: string;
  /** Raw value for the cookie; only its hash is stored. */
  refreshToken: string;
}

const INVALID_CREDENTIALS = 'Invalid email or password';
const INVALID_SESSION = 'Session expired, please log in again';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<PublicUser> {
    const user = await this.users.create({
      name: dto.name,
      email: dto.email,
      nrp: dto.nrp,
      passwordHash: await argon2.hash(dto.password),
    });
    if (!user) throw new ConflictException('Email or NRP is already registered');
    return user;
  }

  async login(dto: LoginDto): Promise<IssuedTokens> {
    const user = await this.users.findByEmailWithPassword(dto.email);
    if (!user) {
      // Hash anyway so "unknown email" takes as long as "wrong password" and cannot be told apart.
      await argon2.hash(dto.password);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (!(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (user.deactivatedAt) throw new UnauthorizedException('Account is deactivated');

    // A login starts a new token family; refreshes stay in it.
    return this.issueTokens(user.id, randomUUID());
  }

  async refresh(rawToken: string | undefined): Promise<IssuedTokens> {
    const stored = rawToken
      ? await this.refreshTokens.findByHash(hashRefreshToken(rawToken))
      : null;
    if (!stored) throw new UnauthorizedException(INVALID_SESSION);

    const state = classifyRefreshToken(stored, new Date());
    if (state === 'reused') {
      await this.refreshTokens.revokeFamily(stored.familyId);
      throw new UnauthorizedException(INVALID_SESSION);
    }
    if (state === 'expired') throw new UnauthorizedException(INVALID_SESSION);

    const user = await this.users.findById(stored.userId);
    if (!user || user.deactivatedAt) {
      await this.refreshTokens.revokeFamily(stored.familyId);
      throw new UnauthorizedException(INVALID_SESSION);
    }

    const next = this.newRefreshToken(user.id, stored.familyId);
    await this.refreshTokens.rotate(stored.id, next.record);
    return { accessToken: await this.signAccessToken(user.id), refreshToken: next.raw };
  }

  /** Idempotent: logging out with a missing or unknown cookie still succeeds. */
  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    const stored = await this.refreshTokens.findByHash(hashRefreshToken(rawToken));
    if (stored) await this.refreshTokens.revoke(stored.id);
  }

  private async issueTokens(userId: string, familyId: string): Promise<IssuedTokens> {
    const next = this.newRefreshToken(userId, familyId);
    await this.refreshTokens.create(next.record);
    return { accessToken: await this.signAccessToken(userId), refreshToken: next.raw };
  }

  private newRefreshToken(userId: string, familyId: string) {
    const raw = generateRefreshToken();
    return {
      raw,
      record: {
        userId,
        familyId,
        tokenHash: hashRefreshToken(raw),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    };
  }

  private signAccessToken(userId: string): Promise<string> {
    return this.jwt.signAsync({ sub: userId });
  }
}

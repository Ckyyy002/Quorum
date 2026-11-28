import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
import { PasswordResetRequested } from './auth.events';
import { RESET_TOKEN_TTL_MS, resetTokenProblem } from './domain/password-reset';
import type { LoginDto } from './dto/login.dto';
import type { ForgotPasswordDto, ResetPasswordDto } from './dto/password-reset.dto';
import type { RegisterDto } from './dto/register.dto';
import { PasswordResetRepository } from './password-reset.repository';
import { RefreshTokenRepository } from './refresh-token.repository';

export interface IssuedTokens {
  accessToken: string;
  /** Raw value for the cookie; only its hash is stored. */
  refreshToken: string;
}

const INVALID_CREDENTIALS = 'Invalid email or password';
const INVALID_SESSION = 'Session expired, please log in again';
const INVALID_RESET_LINK = 'This reset link is invalid, already used or expired; request a new one';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly resets: PasswordResetRepository,
    private readonly jwt: JwtService,
    private readonly events: EventEmitter2,
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

  /**
   * US-1.6: the caller always gets 202, so the answer never tells whether an email is registered. Only an
   * active account gets a link. The token is random like a refresh token, and stored as its SHA-256 hash.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.users.findByEmailWithPassword(dto.email);
    if (!user || user.deactivatedAt) return;
    const raw = generateRefreshToken();
    await this.resets.replace(
      user.id,
      hashRefreshToken(raw),
      new Date(Date.now() + RESET_TOKEN_TTL_MS),
    );
    this.events.emit(
      PasswordResetRequested.event,
      new PasswordResetRequested(user.id, user.name, user.email, raw),
    );
  }

  /** US-1.6: a valid link sets the new password and logs every device out. */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const stored = await this.resets.findByHash(hashRefreshToken(dto.token));
    if (!stored || resetTokenProblem(stored, new Date())) {
      throw new BadRequestException(INVALID_RESET_LINK);
    }
    const done = await this.resets.reset(stored.id, stored.userId, await argon2.hash(dto.password));
    // Someone else used the same link between the check and the write.
    if (!done) throw new BadRequestException(INVALID_RESET_LINK);
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

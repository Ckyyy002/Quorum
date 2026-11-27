import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { paginated, PaginationQueryDto, skipTake } from '../common/pagination';
import { MembershipsService } from '../org/memberships.service';
import { AVATAR_FILES } from '../upload/domain/upload-rules';
import { UploadService } from '../upload/upload.service';
import type { UpdateMeDto } from './dto/update-me.dto';
import { type PublicUser, UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly memberships: MembershipsService,
    private readonly uploads: UploadService,
  ) {}

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Profile plus the active membership; `membership: null` means a Guest in the active period. */
  async getMe(userId: string) {
    const user = await this.getProfile(userId);
    return { ...user, membership: await this.memberships.me(userId) };
  }

  /** US-1.5 AC1: name and NRP; 409 when the NRP belongs to someone else. */
  async updateMe(userId: string, dto: UpdateMeDto) {
    const updated = await this.users.update(userId, dto);
    if (!updated) throw new ConflictException('This NRP is already registered');
    return this.getMe(userId);
  }

  /**
   * US-1.5 AC2: the new picture is stored and linked first; the old file is removed only after that, so a
   * failed upload never leaves the user without their previous avatar.
   */
  async setAvatar(userId: string, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Choose an image file');
    const old = (await this.getProfile(userId)).avatarFileId;
    const stored = await this.uploads.store(file, userId, { kind: 'AVATAR', accept: AVATAR_FILES });
    await this.users.update(userId, { avatarFileId: stored.id });
    await this.uploads.remove(old);
    return this.getMe(userId);
  }

  /** 404 for an unknown user or one without a picture. */
  async avatar(userId: string) {
    const user = await this.users.findById(userId);
    return this.uploads.open(user?.avatarFileId);
  }

  async search(query: PaginationQueryDto) {
    const { data, total } = await this.users.search(query.q, skipTake(query));
    return paginated(data, total, query);
  }
}

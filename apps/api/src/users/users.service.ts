import { Injectable, NotFoundException } from '@nestjs/common';
import { paginated, PaginationQueryDto, skipTake } from '../common/pagination';
import { MembershipsService } from '../org/memberships.service';
import { type PublicUser, UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly memberships: MembershipsService,
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

  async search(query: PaginationQueryDto) {
    const { data, total } = await this.users.search(query.q, skipTake(query));
    return paginated(data, total, query);
  }
}

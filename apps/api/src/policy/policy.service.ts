import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { can, type Action, type Actor, type Scope } from './domain/policy';
import { PolicyRepository } from './policy.repository';

/** Which kind of resource a route's `:id` names, so the guard can load its scope. */
export type ScopeSource = 'department' | 'kesekjenan';

@Injectable()
export class PolicyService {
  constructor(private readonly repo: PolicyRepository) {}

  /** Loaded fresh on every request, so a changed or ended membership takes effect immediately (US-2.4). */
  async actorFor(userId: string): Promise<Actor> {
    const user = await this.repo.findUser(userId);
    if (!user) throw new UnauthorizedException();
    return {
      userId,
      isAdmin: user.isAdmin,
      membership: await this.repo.findActorMembership(userId),
    };
  }

  async authorize(
    userId: string,
    action: Action,
    source?: ScopeSource,
    id?: string,
  ): Promise<void> {
    const actor = await this.actorFor(userId);
    let scope: Scope = {};
    if (source && id) {
      const found =
        source === 'department'
          ? await this.repo.departmentScope(id)
          : await this.repo.kesekjenanScope(id);
      if (!found) throw new NotFoundException(`${source} not found`);
      scope = found;
    }
    if (!can(actor, action, scope)) throw new ForbiddenException('You are not allowed to do this');
  }
}

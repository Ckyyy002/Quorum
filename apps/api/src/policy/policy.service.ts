import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { can, type Action, type Actor, type Scope } from './domain/policy';
import { PolicyRepository } from './policy.repository';

/** Which kind of resource a route's `:id` names, so the guard can load its scope. */
export type ScopeSource = 'department' | 'kesekjenan' | 'biro' | 'proker' | 'task';

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
      // Guards run before ParseUUIDPipe, so a malformed id must be a 400 here, not a 404.
      if (!isUUID(id)) throw new BadRequestException('id must be a UUID');
      const found = await this.loadScope(source, id);
      if (!found) throw new NotFoundException(`${source} not found`);
      scope = found;
    }
    if (!can(actor, action, scope)) throw new ForbiddenException('You are not allowed to do this');
  }

  private loadScope(source: ScopeSource, id: string): Promise<Scope | null> {
    if (source === 'department') return this.repo.departmentScope(id);
    if (source === 'kesekjenan') return this.repo.kesekjenanScope(id);
    if (source === 'biro') return this.repo.biroScope(id);
    if (source === 'task') return this.repo.taskScope(id);
    return this.repo.prokerScope(id);
  }
}

import {
  applyDecorators,
  type CanActivate,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiForbiddenResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthUser } from '../auth/current-user.decorator';
import type { Action } from './domain/policy';
import { PolicyService, type ScopeSource } from './policy.service';

interface PolicyMeta {
  action: Action;
  /** The route's `:id` param names this kind of resource; its scope is loaded before the check. */
  scope?: ScopeSource;
}

const POLICY_KEY = 'policy';

@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly policy: PolicyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.get<PolicyMeta | undefined>(POLICY_KEY, context.getHandler());
    if (!meta) return true;
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as AuthUser;
    await this.policy.authorize(
      user.userId,
      meta.action,
      meta.scope,
      req.params['id'] as string | undefined,
    );
    return true;
  }
}

/** Declares the permission a route needs; the rule itself lives in policy/domain/policy.ts. */
export function CheckPolicy(action: Action, scope?: ScopeSource) {
  return applyDecorators(
    SetMetadata(POLICY_KEY, { action, scope } satisfies PolicyMeta),
    UseGuards(PolicyGuard),
    ApiForbiddenResponse({ description: `Requires permission "${action}".` }),
  );
}

import { Global, Module } from '@nestjs/common';
import { PolicyGuard } from './check-policy.decorator';
import { PolicyRepository } from './policy.repository';
import { PolicyService } from './policy.service';

/** Global so any module can use @CheckPolicy() without importing this one. */
@Global()
@Module({
  providers: [PolicyRepository, PolicyService, PolicyGuard],
  exports: [PolicyService, PolicyGuard],
})
export class PolicyModule {}

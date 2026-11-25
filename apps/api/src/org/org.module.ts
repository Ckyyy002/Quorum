import { Module } from '@nestjs/common';
import { MembershipRepository } from './membership.repository';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';
import { OrgRepository } from './org.repository';
import { OrgService } from './org.service';
import { PeriodsController } from './periods.controller';
import { UnitsController } from './units.controller';

/** Period → Kesekjenan → Department → Biro, and the memberships that place users in them. */
@Module({
  controllers: [PeriodsController, UnitsController, MembershipsController],
  providers: [OrgRepository, OrgService, MembershipRepository, MembershipsService],
  exports: [OrgService, MembershipsService],
})
export class OrgModule {}

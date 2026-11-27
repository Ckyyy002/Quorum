import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { CheckPolicy } from '../policy/check-policy.decorator';
import { DashboardService } from './dashboard.service';

/** US-9: what each role sees on the home page. All numbers are for the active period; "this month" is WIB. */
@ApiTags('dashboard')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** "Perlu tindakanmu": documents waiting for my step, my open tasks, my next meetings. */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.dashboard.me(user.userId);
  }

  @Get('organization')
  @CheckPolicy('dashboard:organization')
  @ApiForbiddenResponse({ description: 'Only Admin, Ketua and the Sekjen.' })
  organization(@CurrentUser() user: AuthUser) {
    return this.dashboard.organization(user.userId);
  }

  @Get('budget')
  @CheckPolicy('dashboard:budget')
  @ApiForbiddenResponse({ description: 'Only Admin, Ketua and the Sekjen Keuangan.' })
  budget(@CurrentUser() user: AuthUser) {
    return this.dashboard.budget(user.userId);
  }

  @Get('department/:id')
  @CheckPolicy('department:overview', 'department')
  @ApiForbiddenResponse({ description: 'Not a lead of this department (or above it).' })
  @ApiNotFoundResponse({ description: 'Department not found.' })
  department(@Param('id', ParseUUIDPipe) id: string) {
    return this.dashboard.department(id);
  }
}

import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { PaginationQueryDto } from '../common/pagination';
import { CheckPolicy } from '../policy/check-policy.decorator';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller()
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOkResponse({
    description: 'Profile plus active membership (position, role group, units, PIC proker).',
  })
  getMe(@CurrentUser() user: AuthUser) {
    return this.users.getMe(user.userId);
  }

  @Get('users')
  @CheckPolicy('org:manage')
  search(@Query() query: PaginationQueryDto) {
    return this.users.search(query);
  }
}

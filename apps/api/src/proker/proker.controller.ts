import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { CheckPolicy } from '../policy/check-policy.decorator';
import {
  AssignProkerDto,
  ChangeProkerStatusDto,
  CreateProkerDto,
  ListProkersQueryDto,
  UpdateProkerDto,
} from './dto/proker.dto';
import { ProkerService } from './proker.service';

@ApiTags('proker')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiNotFoundResponse({ description: 'Proker, department, biro or membership not found.' })
@Controller()
export class ProkerController {
  constructor(private readonly prokers: ProkerService) {}

  /** Public summary of the active period's proker (US-3.8); open to every logged-in user. */
  @Get('prokers')
  list(@Query() query: ListProkersQueryDto) {
    return this.prokers.list(query);
  }

  @Post('departments/:id/prokers')
  @CheckPolicy('proker:manage', 'department')
  @ApiBadRequestResponse({ description: 'Biro or PIC outside the department.' })
  @ApiConflictResponse({ description: 'Name already used in the department.' })
  create(
    @Param('id', ParseUUIDPipe) departmentId: string,
    @Body() dto: CreateProkerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.prokers.create(departmentId, dto, user.userId);
  }

  @Get('prokers/:id')
  @CheckPolicy('proker:view', 'proker')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.prokers.get(id);
  }

  @Patch('prokers/:id')
  @CheckPolicy('proker:edit', 'proker')
  @ApiConflictResponse({ description: 'Name already used in the department.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProkerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.prokers.update(id, dto, user.userId);
  }

  @Patch('prokers/:id/assignment')
  @CheckPolicy('proker:manage', 'proker')
  @ApiBadRequestResponse({ description: 'Biro or PIC outside the department.' })
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignProkerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.prokers.assign(id, dto, user.userId);
  }

  @Delete('prokers/:id')
  @CheckPolicy('proker:manage', 'proker')
  @ApiConflictResponse({ description: 'The proposal is already approved.' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.prokers.remove(id, user.userId);
  }

  @Post('prokers/:id/status')
  @HttpCode(HttpStatus.OK)
  @CheckPolicy('proker:status', 'proker')
  @ApiBadRequestResponse({ description: 'Transition not allowed, or cancelling without a reason.' })
  @ApiConflictResponse({ description: 'DONE before the LPJ is in review.' })
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeProkerStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.prokers.changeStatus(id, dto, user.userId);
  }
}

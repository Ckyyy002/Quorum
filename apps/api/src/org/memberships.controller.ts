import {
  Body,
  Controller,
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
  ApiTags,
} from '@nestjs/swagger';
import { CheckPolicy } from '../policy/check-policy.decorator';
import {
  CreateMembershipDto,
  ListMembershipsQueryDto,
  UpdateMembershipDto,
} from './dto/membership.dto';
import { MembershipsService } from './memberships.service';

@ApiTags('org')
@ApiBearerAuth()
@Controller('memberships')
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get()
  @CheckPolicy('org:manage')
  list(@Query() query: ListMembershipsQueryDto) {
    return this.memberships.list(query);
  }

  @Post()
  @CheckPolicy('org:manage')
  @ApiBadRequestResponse({ description: 'Position and unit do not fit together.' })
  @ApiConflictResponse({ description: 'Seat taken, or the user already has an active membership.' })
  create(@Body() dto: CreateMembershipDto) {
    return this.memberships.create(dto);
  }

  @Patch(':id')
  @CheckPolicy('org:manage')
  @ApiBadRequestResponse({ description: 'Position and unit do not fit together.' })
  @ApiConflictResponse({ description: 'Seat taken.' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMembershipDto) {
    return this.memberships.update(id, dto);
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  @CheckPolicy('org:manage')
  end(@Param('id', ParseUUIDPipe) id: string) {
    return this.memberships.end(id);
  }
}

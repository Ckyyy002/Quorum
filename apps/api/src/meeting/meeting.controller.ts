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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { CheckPolicy } from '../policy/check-policy.decorator';
import { CreateMeetingDto, MyMeetingsQueryDto, UpdateMeetingDto } from './dto/meeting.dto';
import { MeetingService } from './meeting.service';

/** US-6 meetings: schedule by type, reschedule or cancel before the start, my meetings. */
@ApiTags('meeting')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiNotFoundResponse({ description: 'Meeting or unit not found.' })
@Controller()
export class MeetingController {
  constructor(private readonly meetings: MeetingService) {}

  @Get('me/meetings')
  mine(@CurrentUser() user: AuthUser, @Query() query: MyMeetingsQueryDto) {
    return this.meetings.mine(user.userId, query);
  }

  /** Authorized in the service: the rule depends on the type and unit in the body (`meeting:schedule`). */
  @Post('meetings')
  @ApiForbiddenResponse({
    description: 'Not allowed to organize this type of meeting for this unit.',
  })
  @ApiBadRequestResponse({
    description:
      'Missing unit id, start in the past or < 24 h without urgent + reason, unknown extra invitee.',
  })
  create(@Body() dto: CreateMeetingDto, @CurrentUser() user: AuthUser) {
    return this.meetings.create(dto, user.userId);
  }

  @Get('meetings/:id')
  @CheckPolicy('meeting:view', 'meeting')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.meetings.get(id);
  }

  @Patch('meetings/:id')
  @CheckPolicy('meeting:organize', 'meeting')
  @ApiBadRequestResponse({
    description: 'New start in the past or < 24 h without urgent + reason.',
  })
  @ApiConflictResponse({ description: 'The meeting already started, or is cancelled or done.' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMeetingDto) {
    return this.meetings.update(id, dto);
  }

  @Post('meetings/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @CheckPolicy('meeting:organize', 'meeting')
  @ApiConflictResponse({ description: 'The meeting already started, or is cancelled or done.' })
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.meetings.cancel(id);
  }
}

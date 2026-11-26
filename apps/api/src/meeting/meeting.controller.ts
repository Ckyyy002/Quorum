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
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { CheckPolicy } from '../policy/check-policy.decorator';
import { SingleFileInterceptor } from '../upload/file-interceptor';
import { CreateMeetingDto, MyMeetingsQueryDto, UpdateMeetingDto } from './dto/meeting.dto';
import { PublishMinutesDto, UpdateMinutesDto } from './dto/minutes.dto';
import { MeetingService } from './meeting.service';
import { MinutesService } from './minutes.service';

/** US-6 meetings: schedule by type, reschedule or cancel before the start, my meetings. */
@ApiTags('meeting')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiNotFoundResponse({ description: 'Meeting or unit not found.' })
@Controller()
export class MeetingController {
  constructor(
    private readonly meetings: MeetingService,
    private readonly minutes: MinutesService,
  ) {}

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

  /** US-6.3: summary, decisions, carried-over items and next actions (each becomes a task). */
  @Post('meetings/:id/minutes')
  @CheckPolicy('meeting:organize', 'meeting')
  @ApiBadRequestResponse({
    description: 'A next action PIC is not invited, or its deadline passed.',
  })
  @ApiConflictResponse({ description: 'Already published, cancelled, or not started yet.' })
  publishMinutes(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishMinutesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.minutes.publish(id, dto, user.userId);
  }

  /** Any field; `nextActions` are added as new tasks. */
  @Patch('meetings/:id/minutes')
  @CheckPolicy('meeting:organize', 'meeting')
  @ApiBadRequestResponse({
    description: 'A next action PIC is not invited, or its deadline passed.',
  })
  updateMinutes(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMinutesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.minutes.update(id, dto, user.userId);
  }

  /** Multipart `file` (JPG, PNG, WebP, PDF, DOCX, XLSX, PPTX; max 10 MB); replaces the previous one. */
  @Put('meetings/:id/minutes/file')
  @CheckPolicy('meeting:organize', 'meeting')
  @UseInterceptors(SingleFileInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBadRequestResponse({ description: 'No file, or a type that is not allowed.' })
  @ApiPayloadTooLargeResponse({ description: 'File larger than 10 MB.' })
  setMinutesFile(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.minutes.setFile(id, file, user.userId);
  }

  @Get('meetings/:id/minutes/file')
  @CheckPolicy('meeting:view', 'meeting')
  async minutesFile(@Param('id', ParseUUIDPipe) id: string) {
    const { stream, ...headers } = await this.minutes.file(id);
    return new StreamableFile(stream, headers);
  }
}

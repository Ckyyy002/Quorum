import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import { AttendanceService } from './attendance.service';
import { CheckInDto, MarkAttendanceDto } from './dto/attendance.dto';

/** US-7: the organizer opens attendance and shows a rotating QR; invitees scan it to check in. */
@ApiTags('attendance')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiNotFoundResponse({ description: 'Meeting not found.' })
@Controller('meetings/:id')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post('attendance/open')
  @HttpCode(HttpStatus.OK)
  @CheckPolicy('meeting:organize', 'meeting')
  @ApiForbiddenResponse({ description: 'Not the organizer.' })
  @ApiConflictResponse({ description: 'Cancelled, or more than 30 minutes before the start.' })
  open(@Param('id', ParseUUIDPipe) id: string) {
    return this.attendance.open(id);
  }

  @Post('attendance/close')
  @HttpCode(HttpStatus.OK)
  @CheckPolicy('meeting:organize', 'meeting')
  @ApiForbiddenResponse({ description: 'Not the organizer.' })
  close(@Param('id', ParseUUIDPipe) id: string) {
    return this.attendance.close(id);
  }

  /** `{ token, expiresAt }`, valid for 60 seconds. */
  @Get('attendance/token')
  @CheckPolicy('meeting:organize', 'meeting')
  @ApiForbiddenResponse({ description: 'Not the organizer.' })
  @ApiConflictResponse({ description: 'Attendance is not open.' })
  token(@Param('id', ParseUUIDPipe) id: string) {
    return this.attendance.token(id);
  }

  @Post('check-in')
  @CheckPolicy('attendance:check-in', 'meeting')
  @ApiForbiddenResponse({ description: 'Not invited to this meeting.' })
  @ApiBadRequestResponse({
    description: 'Expired or invalid token, attendance closed, or more than 30 minutes early.',
  })
  @ApiConflictResponse({ description: 'Attendance already recorded.' })
  checkIn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CheckInDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.attendance.checkIn(id, dto, user.userId);
  }

  @Put('attendance/:membershipId')
  @CheckPolicy('meeting:organize', 'meeting')
  @ApiForbiddenResponse({ description: 'Not the organizer.' })
  @ApiBadRequestResponse({ description: 'The member is not invited.' })
  @ApiConflictResponse({ description: 'The meeting was cancelled.' })
  mark(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() dto: MarkAttendanceDto,
  ) {
    return this.attendance.mark(id, membershipId, dto);
  }
}

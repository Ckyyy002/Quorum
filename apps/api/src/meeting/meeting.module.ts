import { Module } from '@nestjs/common';
import { MeetingController } from './meeting.controller';
import { MeetingRepository } from './meeting.repository';
import { MeetingService } from './meeting.service';

/** Meetings of every type (US-6); minutes (US-6.3) and QR attendance (US-7) join this module. */
@Module({
  controllers: [MeetingController],
  providers: [MeetingRepository, MeetingService],
})
export class MeetingModule {}

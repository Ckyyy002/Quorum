import { Module } from '@nestjs/common';
import { UploadModule } from '../upload/upload.module';
import { MeetingController } from './meeting.controller';
import { MeetingRepository } from './meeting.repository';
import { MeetingService } from './meeting.service';
import { MinutesService } from './minutes.service';

/** Meetings of every type (US-6); minutes (US-6.3) and QR attendance (US-7) join this module. */
@Module({
  imports: [UploadModule],
  controllers: [MeetingController],
  providers: [MeetingRepository, MeetingService, MinutesService],
})
export class MeetingModule {}

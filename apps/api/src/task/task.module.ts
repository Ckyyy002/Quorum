import { Module } from '@nestjs/common';
import { UploadModule } from '../upload/upload.module';
import { TaskController } from './task.controller';
import { TaskRepository } from './task.repository';
import { TaskService } from './task.service';

/** Proker tasks (US-4) and, later, meeting next actions (US-6.3) — one board, one "my tasks" list. */
@Module({
  imports: [UploadModule],
  controllers: [TaskController],
  providers: [TaskRepository, TaskService],
})
export class TaskModule {}

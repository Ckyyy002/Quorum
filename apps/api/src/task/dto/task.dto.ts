import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';
import { trim } from '../../common/transforms';
import {
  TASK_SOURCES,
  TASK_STATUSES,
  type TaskSource,
  type TaskStatus,
} from '../domain/task-rules';

// The regex fixes the shape (a day, no time); IsDateString strict rejects impossible days like 2026-13-45.
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MESSAGE = 'must be a day like 2026-12-10';

export class CreateTaskDto {
  @ApiProperty({ example: 'Susun rundown acara' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({
    example: '2026-12-10',
    description: 'Last day to finish it, in WIB; not in the past.',
  })
  @Matches(DAY, { message: `deadline ${DAY_MESSAGE}` })
  @IsDateString({ strict: true }, { message: `deadline ${DAY_MESSAGE}` })
  deadline!: string;

  @ApiProperty({ description: 'An active member of the proker department.' })
  @IsUUID()
  assigneeMembershipId!: string;
}

/** Any subset; a new assignee is a reassignment and is emailed (US-4.2 AC1). */
export class UpdateTaskDto extends PartialType(CreateTaskDto) {}

export class ChangeTaskStatusDto {
  @ApiProperty({ enum: TASK_STATUSES })
  @IsIn(TASK_STATUSES)
  status!: TaskStatus;
}

/** Board filters (US-4.4). */
export class ListProkerTasksQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TASK_STATUSES })
  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeMembershipId?: string;
}

/** US-4.5 AC1. Always sorted by nearest deadline first. */
export class MyTasksQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TASK_STATUSES })
  @IsOptional()
  @IsIn(TASK_STATUSES)
  status?: TaskStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  prokerId?: string;

  @ApiPropertyOptional({ enum: TASK_SOURCES })
  @IsOptional()
  @IsIn(TASK_SOURCES)
  source?: TaskSource;

  @ApiPropertyOptional({ example: '2026-12-01' })
  @IsOptional()
  @Matches(DAY, { message: `deadlineFrom ${DAY_MESSAGE}` })
  @IsDateString({ strict: true }, { message: `deadlineFrom ${DAY_MESSAGE}` })
  deadlineFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @Matches(DAY, { message: `deadlineTo ${DAY_MESSAGE}` })
  @IsDateString({ strict: true }, { message: `deadlineTo ${DAY_MESSAGE}` })
  deadlineTo?: string;
}

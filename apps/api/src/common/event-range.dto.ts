import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID, Matches } from 'class-validator';
import { PaginationQueryDto } from './pagination';
import { wibDay } from './wib';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Unit and event-day filters shared by the proker search (US-8.1) and the document search (US-8.2). */
export class EventRangeQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  kesekjenanId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ example: '2026-12-01', description: 'Event day from (WIB, inclusive).' })
  @IsOptional()
  @Matches(DAY, { message: 'eventFrom must be a day like 2026-12-01' })
  @IsDateString({ strict: true }, { message: 'eventFrom must be a day like 2026-12-01' })
  eventFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Event day until (WIB, inclusive).' })
  @IsOptional()
  @Matches(DAY, { message: 'eventTo must be a day like 2026-12-31' })
  @IsDateString({ strict: true }, { message: 'eventTo must be a day like 2026-12-31' })
  eventTo?: string;
}

/** Event days are stored as 00:00 WIB, so an inclusive day range is a plain gte/lte on that instant. */
export function eventDayRange(q: { eventFrom?: string; eventTo?: string }) {
  if (!q.eventFrom && !q.eventTo) return undefined;
  return {
    gte: q.eventFrom ? wibDay(q.eventFrom) : undefined,
    lte: q.eventTo ? wibDay(q.eventTo) : undefined,
  };
}

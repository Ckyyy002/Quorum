import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { trim } from '../../common/transforms';

export class CheckInDto {
  @ApiProperty({ description: 'The token from the QR on the organizer screen.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token!: string;
}

export const MARKS = ['PRESENT', 'EXCUSED'] as const;

/** US-7.3: the organizer marks an invitee present (e.g. no phone) or excused. */
export class MarkAttendanceDto {
  @ApiProperty({ enum: MARKS })
  @IsIn(MARKS)
  status!: (typeof MARKS)[number];

  @ApiPropertyOptional({ example: 'Sakit, surat menyusul' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  note?: string;
}

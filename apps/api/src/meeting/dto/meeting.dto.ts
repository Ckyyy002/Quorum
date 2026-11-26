import { ApiProperty, ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';
import { trim } from '../../common/transforms';
import { MEETING_TYPES, type MeetingType } from '../domain/meeting-rules';

/** Buku Biru BAB V: every agenda item says what it should produce and what to prepare. */
export class AgendaItemDto {
  @ApiProperty({ example: 'Evaluasi Bluecamp' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  topic!: string;

  @ApiProperty({ example: 'Daftar perbaikan untuk tahun depan' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  expectedOutput!: string;

  @ApiPropertyOptional({ example: 'Laporan panitia' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  materials?: string;
}

export class CreateMeetingDto {
  @ApiProperty({ enum: MEETING_TYPES })
  @IsIn(MEETING_TYPES)
  type!: MeetingType;

  @ApiProperty({ example: 'Rapat Departemen SRD #3' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @ApiProperty({ type: [AgendaItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AgendaItemDto)
  agenda!: AgendaItemDto[];

  @ApiProperty({ example: '2026-12-12T19:00:00+07:00', description: 'Start, with its UTC offset.' })
  @IsISO8601({ strict: true })
  startsAt!: string;

  @ApiProperty({ example: 90, minimum: 15, maximum: 600 })
  @IsInt()
  @Min(15)
  @Max(600)
  durationMin!: number;

  @ApiProperty({ example: 'Ruang HMTC / https://meet.google.com/…' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  location!: string;

  @ApiPropertyOptional({ description: 'Needed to start less than 24 hours from now.' })
  @IsOptional()
  @IsBoolean()
  urgent?: boolean;

  @ApiPropertyOptional({ description: 'Required (≥ 10 characters) when urgent.' })
  @ValidateIf((dto: CreateMeetingDto) => dto.urgent === true || dto.urgentReason !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(10, { message: 'urgentReason must explain the urgency (at least 10 characters)' })
  @MaxLength(500)
  urgentReason?: string;

  @ApiPropertyOptional({ description: 'KESEKJENAN meetings.' })
  @IsOptional()
  @IsUUID()
  kesekjenanId?: string;

  @ApiPropertyOptional({ description: 'DEPARTEMEN meetings.' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'BIRO meetings.' })
  @IsOptional()
  @IsUUID()
  biroId?: string;

  @ApiPropertyOptional({ description: 'PROKER meetings.' })
  @IsOptional()
  @IsUUID()
  prokerId?: string;

  @ApiPropertyOptional({
    description: 'Active members invited on top of the defaults, as optional invitees.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  extraInviteeIds?: string[];
}

/** US-6.2: time, place, title or agenda; the type and invitees stay. */
export class UpdateMeetingDto extends PartialType(
  PickType(CreateMeetingDto, [
    'title',
    'agenda',
    'startsAt',
    'durationMin',
    'location',
    'urgent',
    'urgentReason',
  ] as const),
) {}

export const RANGES = ['upcoming', 'past'] as const;

/** US-6.8: upcoming (nearest first) or past (latest first). */
export class MyMeetingsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: RANGES, default: 'upcoming' })
  @IsOptional()
  @IsIn(RANGES)
  range: (typeof RANGES)[number] = 'upcoming';
}

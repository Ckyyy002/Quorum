import { ApiProperty, ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { EventRangeQueryDto } from '../../common/event-range.dto';
import { trim } from '../../common/transforms';
import { ASSIGNABLE_ROLES, type AssignableRole } from '../domain/committee';
import {
  PROKER_STATUSES,
  PROKER_TYPES,
  type ProkerStatus,
  type ProkerType,
} from '../domain/proker-status';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class CreateProkerDto {
  @ApiProperty({ example: 'Bluecamp 2026', description: 'Unique within the department.' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ enum: PROKER_TYPES })
  @IsIn(PROKER_TYPES)
  type!: ProkerType;

  @ApiPropertyOptional({ example: '2026-08-17', description: 'Event day (H) in WIB.' })
  @IsOptional()
  @Matches(DAY, { message: 'eventDate must be a day like 2026-08-17' })
  eventDate?: string;

  @ApiPropertyOptional({ description: 'Integer rupiah.', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedBudget?: number;

  @ApiPropertyOptional({ description: 'Executing biro; must be in the department.' })
  @IsOptional()
  @IsUUID()
  biroId?: string;

  @ApiPropertyOptional({ description: 'Active membership in the department.' })
  @IsOptional()
  @IsUUID()
  picMembershipId?: string;
}

/** Details anyone allowed to edit may change (US-3.2, 3.3, 3.7). Biro and PIC go through /assignment. */
export class UpdateProkerDto extends PartialType(
  PickType(CreateProkerDto, [
    'name',
    'description',
    'type',
    'eventDate',
    'estimatedBudget',
  ] as const),
) {}

/** Dept lead only (US-3.2 AC1). `null` clears the field; a proker without PIC "needs PIC". */
export class AssignProkerDto {
  @ApiProperty({ nullable: true, type: String })
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  biroId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  picMembershipId!: string | null;
}

export class ChangeProkerStatusDto {
  @ApiProperty({ enum: PROKER_STATUSES })
  @IsIn(PROKER_STATUSES)
  status!: ProkerStatus;

  @ApiPropertyOptional({ description: 'Required when cancelling.' })
  @ValidateIf((dto: ChangeProkerStatusDto) => dto.status === 'CANCELLED')
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'reason is required when cancelling' })
  @MaxLength(500)
  reason?: string;
}

/** US-8.1: every filter is combined with AND; unknown values are a 400. */
export class ListProkersQueryDto extends EventRangeQueryDto {
  @ApiPropertyOptional({ description: 'Defaults to the active period.' })
  @IsOptional()
  @IsUUID()
  periodId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  biroId?: string;

  @ApiPropertyOptional({ enum: PROKER_STATUSES })
  @IsOptional()
  @IsIn(PROKER_STATUSES)
  status?: ProkerStatus;

  @ApiPropertyOptional({ enum: PROKER_TYPES })
  @IsOptional()
  @IsIn(PROKER_TYPES)
  type?: ProkerType;
}

export class TickChecklistDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ example: 'https://drive.google.com/…' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  evidenceUrl?: string;
}

/** An empty string clears the field; leaving it out keeps it. */
const emptyToNull = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' && value.trim() === '' ? null : trim({ value });

/** US-3.4: a leader adjusts an item. A new label or due date pins it against the template sync. */
export class UpdateChecklistItemDto {
  @ApiPropertyOptional({ example: 'Publikasi poster H-2' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  label?: string;

  @ApiPropertyOptional({ example: '2026-08-15', description: 'Due day in WIB.' })
  @IsOptional()
  @Matches(DAY, { message: 'dueDate must be a day like 2026-08-15' })
  @IsDateString({ strict: true }, { message: 'dueDate must be a day like 2026-08-15' })
  dueDate?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'https://drive.google.com/…' })
  @IsOptional()
  @Transform(emptyToNull)
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  evidenceUrl?: string | null;
}

export class CommitteeSeatDto {
  @ApiProperty()
  @IsUUID()
  membershipId!: string;

  @ApiProperty({
    enum: ASSIGNABLE_ROLES,
    description: 'The PIC is the Ketua Pelaksana automatically.',
  })
  @IsIn(ASSIGNABLE_ROLES)
  role!: AssignableRole;

  @ApiPropertyOptional({ description: 'Required for KADIV.', example: 'Acara' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  divisionName?: string;
}

/** The full committee besides the PIC; it replaces the previous list (US-3.9). */
export class SetCommitteeDto {
  @ApiProperty({ type: [CommitteeSeatDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CommitteeSeatDto)
  members!: CommitteeSeatDto[];
}

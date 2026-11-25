import { ApiProperty, ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';
import { trim } from '../../common/transforms';
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

export class ListProkersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Defaults to the active period.' })
  @IsOptional()
  @IsUUID()
  periodId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

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

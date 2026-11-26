import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { trim } from '../../common/transforms';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class MinutesDecisionDto {
  @ApiProperty({ example: 'Bluecamp diundur ke 20 Desember' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  text!: string;
}

export class CarriedOverDto {
  @ApiProperty({ example: 'Pembagian divisi acara' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  topic!: string;
}

/** Becomes a Task (source MEETING) assigned to the PIC (US-6.3 AC2). */
export class NextActionDto {
  @ApiProperty({ example: 'Kirim surat peminjaman ruang' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @ApiProperty({ description: 'An invitee of the meeting.' })
  @IsUUID()
  picMembershipId!: string;

  @ApiProperty({ example: '2026-12-14', description: 'Last day, in WIB; not in the past.' })
  @Matches(DAY, { message: 'deadline must be a day like 2026-12-14' })
  @IsDateString({ strict: true }, { message: 'deadline must be a day like 2026-12-14' })
  deadline!: string;
}

/** US-6.3 AC1: the file is attached separately (PUT …/minutes/file), like task evidence. */
export class PublishMinutesDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  summary!: string;

  @ApiProperty({ type: [MinutesDecisionDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => MinutesDecisionDto)
  decisions!: MinutesDecisionDto[];

  @ApiPropertyOptional({ type: [CarriedOverDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CarriedOverDto)
  carriedOver?: CarriedOverDto[];

  @ApiPropertyOptional({ type: [NextActionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => NextActionDto)
  nextActions?: NextActionDto[];
}

/**
 * Minutes stay editable (decided by the user). `nextActions` here are NEW actions, added as tasks; existing
 * tasks are edited on the task board.
 */
export class UpdateMinutesDto extends PartialType(PublishMinutesDto) {}

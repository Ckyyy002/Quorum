import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
import { trim } from '../../common/transforms';

const upperCode = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreatePeriodDto {
  @ApiProperty({ example: '2026/2027' })
  @Transform(trim)
  @IsString()
  @Length(3, 30)
  name!: string;

  @ApiProperty({ example: '2026-01-15' })
  @IsDateString({ strict: true })
  startDate!: string;

  @ApiProperty({ example: '2026-12-31' })
  @IsDateString({ strict: true })
  endDate!: string;
}

export class UpdatePeriodDto extends PartialType(CreatePeriodDto) {}

export class CreateDepartmentDto {
  @ApiProperty({ description: 'Kesekjenan the department belongs to (also decides its period).' })
  @IsUUID()
  kesekjenanId!: string;

  @ApiProperty({ example: 'Student Resource Development' })
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  name!: string;

  @ApiProperty({ example: 'SRD', description: 'Unique per period; stored upper-case.' })
  @Transform(upperCode)
  @Matches(/^[A-Z0-9]{2,12}$/, { message: 'code must be 2-12 letters or digits' })
  code!: string;

  @ApiPropertyOptional({ enum: ['DEPARTMENT', 'SPECIAL_BIRO'], default: 'DEPARTMENT' })
  @IsOptional()
  @IsIn(['DEPARTMENT', 'SPECIAL_BIRO'])
  kind?: 'DEPARTMENT' | 'SPECIAL_BIRO';
}

/** Moving a department to another kesekjenan or changing its kind is not supported: recreate it. */
export class UpdateDepartmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(upperCode)
  @Matches(/^[A-Z0-9]{2,12}$/, { message: 'code must be 2-12 letters or digits' })
  code?: string;
}

export class CreateBiroDto {
  @ApiProperty({ example: 'Biro Kaderisasi' })
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  name!: string;

  @ApiProperty({ example: 'KADERISASI', description: 'Unique per department; stored upper-case.' })
  @Transform(upperCode)
  @Matches(/^[A-Z0-9]{2,12}$/, { message: 'code must be 2-12 letters or digits' })
  code!: string;
}

export class UpdateBiroDto extends UpdateDepartmentDto {}

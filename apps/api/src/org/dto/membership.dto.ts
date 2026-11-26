import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination';
import { POSITIONS, type Position } from '../../policy/domain/role-group';

/** Which unit fields a position needs is in data-model.md → Invariants; a wrong mix is a 400. */
export class PlacementDto {
  @ApiProperty({ enum: POSITIONS })
  @IsIn(POSITIONS)
  position!: Position;

  @ApiPropertyOptional({ description: 'KADEP/SEKDEP (department) or ASISTEN_BIRO (special biro).' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ description: 'KABIRO, WAKABIRO, STAFF.' })
  @IsOptional()
  @IsUUID()
  biroId?: string;

  @ApiPropertyOptional({ description: 'SEKJEN_BIDANG: the kesekjenan they oversee.' })
  @IsOptional()
  @IsUUID()
  kesekjenanId?: string;

  @ApiPropertyOptional({ description: 'Sekjen Administrasi/Keuangan: the kesekjenan they review.' })
  @IsOptional()
  @IsUUID()
  coversKesekjenanId?: string;
}

export class CreateMembershipDto extends PlacementDto {
  @ApiProperty()
  @IsUUID()
  userId!: string;

  @ApiProperty()
  @IsUUID()
  periodId!: string;
}

/** Replaces position and unit together (PUT-like), so changing STAFF → KETUA clears the biro. */
export class UpdateMembershipDto extends PlacementDto {}

export class ListMembershipsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  periodId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ enum: POSITIONS })
  @IsOptional()
  @IsIn(POSITIONS)
  position?: Position;

  @ApiPropertyOptional({ default: true, description: 'Only memberships that have not ended.' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  active: boolean = true;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches, ValidateIf } from 'class-validator';
import { trim } from '../../common/transforms';

/**
 * US-1.5 AC1: name and NRP only. The email is the login and stays fixed; sending it is a 400 because the
 * global ValidationPipe rejects fields that are not listed here.
 */
export class UpdateMeDto {
  @ApiPropertyOptional({ example: 'Raka Aditya', minLength: 2, maxLength: 100 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  name?: string;

  @ApiPropertyOptional({
    example: '5025231001',
    nullable: true,
    description: 'ITS student number, 10 digits; null removes it.',
  })
  @IsOptional()
  // null clears the NRP, so only a string is checked.
  @ValidateIf((_, value) => value !== null)
  @Transform(trim)
  @Matches(/^\d{10}$/, { message: 'nrp must be exactly 10 digits' })
  nrp?: string | null;
}

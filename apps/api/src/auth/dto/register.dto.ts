import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trim, trimLower } from '../../common/transforms';

export class RegisterDto {
  @ApiProperty({ example: 'Raka Aditya', minLength: 2, maxLength: 100 })
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  name!: string;

  /** Stored lower-case, so the unique index makes emails case-insensitive. */
  @ApiProperty({ example: 'raka@student.its.ac.id' })
  @Transform(trimLower)
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'Rahasia123',
    description: 'At least 8 characters with an uppercase letter, a lowercase letter and a digit.',
  })
  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  // Upper bound so a huge body cannot make argon2 burn CPU.
  @MaxLength(128)
  @Matches(/[A-Z]/, { message: 'password must contain an uppercase letter' })
  @Matches(/[a-z]/, { message: 'password must contain a lowercase letter' })
  @Matches(/\d/, { message: 'password must contain a digit' })
  password!: string;

  @ApiPropertyOptional({ example: '5025231001', description: 'ITS student number, 10 digits.' })
  @IsOptional()
  @Transform(trim)
  @Matches(/^\d{10}$/, { message: 'nrp must be exactly 10 digits' })
  nrp?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimLower } from '../../common/transforms';

export class LoginDto {
  @ApiProperty({ example: 'raka@student.its.ac.id' })
  @Transform(trimLower)
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Rahasia123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

export class AccessTokenResponseDto {
  @ApiProperty({ description: 'JWT, valid 15 minutes. Keep it in memory, not in localStorage.' })
  accessToken!: string;
}

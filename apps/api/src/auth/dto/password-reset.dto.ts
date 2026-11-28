import { ApiProperty, PickType } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { RegisterDto } from './register.dto';

/** US-1.6: the same email rules as registration. */
export class ForgotPasswordDto extends PickType(RegisterDto, ['email'] as const) {}

/** US-1.6: the token from the emailed link and a new password with the registration rules. */
export class ResetPasswordDto extends PickType(RegisterDto, ['password'] as const) {
  @ApiProperty({ description: 'The `token` query parameter of the emailed link.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  token!: string;
}

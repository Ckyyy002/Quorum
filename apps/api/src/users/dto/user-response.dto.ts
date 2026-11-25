import { ApiProperty } from '@nestjs/swagger';

/** Swagger shape of PublicUser. */
export class UserResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) nrp!: string | null;
  @ApiProperty({ type: String, nullable: true }) avatarPath!: string | null;
  @ApiProperty() isAdmin!: boolean;
  @ApiProperty({ type: Date, nullable: true }) deactivatedAt!: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

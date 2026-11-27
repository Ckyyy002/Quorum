import { ApiProperty } from '@nestjs/swagger';

/** Swagger shape of PublicUser. */
export class UserResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: String, nullable: true }) nrp!: string | null;
  /** Download with GET /users/:id/avatar when set (US-1.5). */
  @ApiProperty({ type: String, nullable: true }) avatarFileId!: string | null;
  @ApiProperty() isAdmin!: boolean;
  @ApiProperty({ type: Date, nullable: true }) deactivatedAt!: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

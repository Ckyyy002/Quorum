import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsUrl, MaxLength } from 'class-validator';
import { trim } from '../common/transforms';

/** Multipart fields next to the optional `file`. An empty string clears the link. */
export class EvidenceDto {
  @ApiPropertyOptional({ nullable: true, example: 'https://drive.google.com/…' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? null : trim({ value }),
  )
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  evidenceUrl?: string | null;
}

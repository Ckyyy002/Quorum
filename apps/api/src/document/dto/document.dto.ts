import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { trim } from '../../common/transforms';
import {
  DOCUMENT_TYPES,
  FUNDING_SOURCES,
  type DocumentType,
  type FundingSource,
} from '../domain/document-workflow';

/** Multipart form: these fields plus an optional `file` (PDF or DOCX, max 10 MB). */
export class CreateDocumentDto {
  @ApiProperty({ enum: DOCUMENT_TYPES })
  @IsIn(DOCUMENT_TYPES)
  type!: DocumentType;

  @ApiProperty({ example: 'Proposal Bluecamp 2026' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @ApiProperty({
    example: 1500000,
    description: 'Integer rupiah: requested for a PROPOSAL, realized for an LPJ.',
  })
  // Multipart sends every field as text, so the number is converted before it is checked.
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  totalBudget!: number;

  @ApiPropertyOptional({ enum: FUNDING_SOURCES })
  @IsOptional()
  @IsIn(FUNDING_SOURCES)
  fundingSource?: FundingSource;
}

/** US-5.1, 5.7: any subset; the type never changes. A `file` in the same form is a new version. */
export class UpdateDocumentDto extends PartialType(
  OmitType(CreateDocumentDto, ['type'] as const),
) {}

export const DECISIONS = ['APPROVE', 'RETURN'] as const;
export type Decision = (typeof DECISIONS)[number];

/** Review (US-5.3, 5.4) and pengesahan (US-5.5): approve, or return with a note. */
export class DecisionDto {
  @ApiProperty({ enum: DECISIONS })
  @IsIn(DECISIONS)
  decision!: Decision;

  @ApiPropertyOptional({ description: 'Required (≥ 10 characters) when returning.' })
  @ValidateIf((dto: DecisionDto) => dto.decision === 'RETURN' || dto.note !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(10, { message: 'note must explain what to fix (at least 10 characters)' })
  @MaxLength(2000)
  note?: string;
}

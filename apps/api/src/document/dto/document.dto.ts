import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { EventRangeQueryDto } from '../../common/event-range.dto';
import { trim } from '../../common/transforms';
import { BUDGET_CATEGORIES, MAX_BUDGET, type BudgetCategory } from '../domain/budget';
import {
  DOCUMENT_STATUSES,
  DOCUMENT_TYPES,
  FUNDING_SOURCES,
  type DocumentStatus,
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

/** US-8.2: every filter combined with AND; visibility is applied on top by the service. */
export class ListDocumentsQueryDto extends EventRangeQueryDto {
  @ApiPropertyOptional({ enum: DOCUMENT_TYPES })
  @IsOptional()
  @IsIn(DOCUMENT_TYPES)
  type?: DocumentType;

  @ApiPropertyOptional({ enum: DOCUMENT_STATUSES })
  @IsOptional()
  @IsIn(DOCUMENT_STATUSES)
  status?: DocumentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  prokerId?: string;

  @ApiPropertyOptional({ description: 'true: only documents with a late step.' })
  @IsOptional()
  @IsIn(['true', 'false'])
  late?: 'true' | 'false';
}

/** US-8.4: `q` matches the proker name; rows are always sorted by nearest open deadline. */
export class TrackerQueryDto extends EventRangeQueryDto {}

/** US-13.1: one RAB line; its subtotal is quantity × unitPrice. */
export class RabLineDto {
  @ApiProperty({ enum: BUDGET_CATEGORIES })
  @IsIn(BUDGET_CATEGORIES)
  category!: BudgetCategory;

  @ApiProperty({ example: 'Snack peserta' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description!: string;

  @ApiProperty({ example: 50 })
  @IsInt()
  @Min(1)
  @Max(100_000)
  quantity!: number;

  @ApiProperty({ example: 20000, description: 'Integer rupiah per unit.' })
  @IsInt()
  @Min(0)
  @Max(MAX_BUDGET)
  unitPrice!: number;
}

/** US-13.1: the whole RAB at once; the proposal's totalBudget becomes its sum. */
export class SetRabDto {
  @ApiProperty({ type: [RabLineDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RabLineDto)
  lines!: RabLineDto[];
}

/** US-13.2 AC1. Multipart form: these fields plus the receipt `file` (JPG, PNG, WebP or PDF, max 10 MB). */
export class CreateSpjDto {
  @ApiProperty({ enum: BUDGET_CATEGORIES })
  @IsIn(BUDGET_CATEGORIES)
  category!: BudgetCategory;

  @ApiProperty({ example: 'Nota konsumsi H-1' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description!: string;

  @ApiProperty({ example: 250000, description: 'Integer rupiah on the receipt.' })
  // Multipart sends every field as text.
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_BUDGET)
  amount!: number;
}

/** US-13.2: fix a pending or returned item; any subset, and/or a new receipt `file`. */
export class UpdateSpjDto extends PartialType(CreateSpjDto) {}

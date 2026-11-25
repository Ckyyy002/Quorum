import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { trim } from './transforms';

/** `?q=&page=&limit=&sort=field:asc|desc` shared by every list endpoint (G4). */
export class PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Free-text search' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 10;

  @ApiPropertyOptional({ example: 'name:asc', description: 'field:asc or field:desc' })
  @IsOptional()
  @Matches(/^[a-zA-Z]+:(asc|desc)$/, { message: 'sort must look like field:asc or field:desc' })
  sort?: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export function paginated<T>(data: T[], total: number, query: PaginationQueryDto): Paginated<T> {
  return {
    data,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

/**
 * Turns `?sort=` into a Prisma-style orderBy, allowing only the listed fields so clients cannot sort
 * on (or probe) arbitrary columns. Returns undefined for an unknown field; the caller answers 400.
 */
export function parseSort<F extends string>(
  sort: string | undefined,
  allowed: readonly F[],
  fallback: Partial<Record<F, 'asc' | 'desc'>>,
): Partial<Record<F, 'asc' | 'desc'>> | undefined {
  if (!sort) return fallback;
  const [field, dir] = sort.split(':') as [F, 'asc' | 'desc'];
  return allowed.includes(field)
    ? ({ [field]: dir } as Partial<Record<F, 'asc' | 'desc'>>)
    : undefined;
}

export const skipTake = (q: PaginationQueryDto) => ({
  skip: (q.page - 1) * q.limit,
  take: q.limit,
});

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { CheckPolicy } from '../policy/check-policy.decorator';
import { SingleFileInterceptor } from '../upload/file-interceptor';
import { BudgetService } from './budget.service';
import { CreateSpjDto, DecisionDto, SetRabDto, UpdateSpjDto } from './dto/document.dto';

/** US-13: RAB lines of a proposal and SPJ items of an LPJ. Every write returns the full document. */
@ApiTags('document')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiForbiddenResponse({ description: 'Not allowed for this document.' })
@ApiNotFoundResponse({ description: 'Document, SPJ item or file not found.' })
@Controller('documents/:id')
export class BudgetController {
  constructor(private readonly budget: BudgetService) {}

  /** US-13.1: replaces every RAB line; totalBudget becomes their sum. */
  @Put('rab')
  @CheckPolicy('document:draft', 'document')
  @ApiBadRequestResponse({ description: 'Invalid line, or a total above Rp 2,000,000,000.' })
  @ApiConflictResponse({ description: 'Not a proposal, or not in DRAFT/REVISION.' })
  setRab(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetRabDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.budget.setRab(id, dto, user.userId);
  }

  /** US-13.2 AC1. Multipart: the fields plus the receipt `file` (JPG, PNG, WebP or PDF, max 10 MB). */
  @Post('spj')
  @CheckPolicy('document:draft', 'document')
  @UseInterceptors(SingleFileInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBadRequestResponse({ description: 'Invalid field, no file, or a file of another type.' })
  @ApiPayloadTooLargeResponse({ description: 'File larger than 10 MB.' })
  @ApiConflictResponse({
    description: 'Not an LPJ, before the event date, or not in DRAFT/REVISION.',
  })
  addSpj(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSpjDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.budget.addSpj(id, dto, file, user.userId);
  }

  /** Multipart: any field and/or a new `file`; the item goes back to PENDING. */
  @Put('spj/:itemId')
  @CheckPolicy('document:draft', 'document')
  @UseInterceptors(SingleFileInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBadRequestResponse({ description: 'Invalid field, or a file of another type.' })
  @ApiPayloadTooLargeResponse({ description: 'File larger than 10 MB.' })
  @ApiConflictResponse({ description: 'Item already verified, or the LPJ cannot change now.' })
  updateSpj(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateSpjDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.budget.updateSpj(id, itemId, dto, file, user.userId);
  }

  /** US-13.2 AC2: APPROVE verifies, RETURN (note required) sends it back to the drafters. */
  @Post('spj/:itemId/verify')
  @HttpCode(HttpStatus.OK)
  @CheckPolicy('spj:verify', 'document')
  @ApiBadRequestResponse({ description: 'Returning without a note of at least 10 characters.' })
  @ApiConflictResponse({ description: 'The item is not PENDING.' })
  verifySpj(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: DecisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.budget.verifySpj(id, itemId, dto, user.userId);
  }

  @Get('spj/:itemId/file')
  @CheckPolicy('document:view', 'document')
  async spjFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    const { stream, ...headers } = await this.budget.spjFile(id, itemId);
    return new StreamableFile(stream, headers);
  }
}

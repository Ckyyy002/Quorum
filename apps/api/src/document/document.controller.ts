import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { CheckPolicy } from '../policy/check-policy.decorator';
import { SingleFileInterceptor } from '../upload/file-interceptor';
import { DocumentService } from './document.service';
import { CreateDocumentDto, DecisionDto, UpdateDocumentDto } from './dto/document.dto';

/**
 * US-5 proposal and LPJ flow. Every write answers 409 when the document is not in the state the step starts
 * from (product.md → Document workflow), and returns the full document so the UI can redraw it.
 */
@ApiTags('document')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiNotFoundResponse({ description: 'Proker, document or file not found.' })
@Controller()
export class DocumentController {
  constructor(private readonly documents: DocumentService) {}

  @Get('prokers/:id/documents')
  @CheckPolicy('proker:view', 'proker')
  list(@Param('id', ParseUUIDPipe) prokerId: string, @CurrentUser() user: AuthUser) {
    return this.documents.listForProker(prokerId, user.userId);
  }

  /** Multipart: the fields plus an optional `file` (PDF or DOCX, max 10 MB). */
  @Post('prokers/:id/documents')
  @CheckPolicy('document:draft', 'proker')
  @UseInterceptors(SingleFileInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBadRequestResponse({ description: 'Invalid field, or a file that is not PDF or DOCX.' })
  @ApiPayloadTooLargeResponse({ description: 'File larger than 10 MB.' })
  @ApiConflictResponse({ description: 'The proker already has a live document of this type.' })
  create(
    @Param('id', ParseUUIDPipe) prokerId: string,
    @Body() dto: CreateDocumentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.create(prokerId, dto, file, user.userId);
  }

  @Get('documents/:id')
  @CheckPolicy('document:view', 'document')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.documents.get(id);
  }

  /** Multipart: any field, and/or a `file` that becomes the next version. Only in DRAFT or REVISION. */
  @Patch('documents/:id')
  @CheckPolicy('document:draft', 'document')
  @UseInterceptors(SingleFileInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBadRequestResponse({ description: 'Invalid field, or a file that is not PDF or DOCX.' })
  @ApiPayloadTooLargeResponse({ description: 'File larger than 10 MB.' })
  @ApiConflictResponse({ description: 'The document is under review or later.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDocumentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.update(id, dto, file, user.userId);
  }

  @Get('documents/:id/files/:fileId')
  @CheckPolicy('document:view', 'document')
  async file(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ) {
    const { stream, ...headers } = await this.documents.file(id, fileId);
    return new StreamableFile(stream, headers);
  }

  @Post('documents/:id/submit')
  @HttpCode(HttpStatus.OK)
  @CheckPolicy('document:submit', 'document')
  @ApiBadRequestResponse({
    description: 'No file yet, or a proposal without budget/funding source.',
  })
  @ApiConflictResponse({ description: 'Not in DRAFT/REVISION, or an LPJ before the event date.' })
  submit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.documents.submit(id, user.userId);
  }

  @Post('documents/:id/review')
  @HttpCode(HttpStatus.OK)
  @CheckPolicy('document:review', 'document')
  @ApiBadRequestResponse({ description: 'Returning without a note of at least 10 characters.' })
  @ApiConflictResponse({ description: 'Not IN_REVIEW, or this part is already approved.' })
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.review(id, dto, user.userId);
  }

  @Post('documents/:id/pengesahan')
  @HttpCode(HttpStatus.OK)
  @CheckPolicy('document:approve', 'document')
  @ApiBadRequestResponse({ description: 'Returning without a note of at least 10 characters.' })
  @ApiConflictResponse({ description: 'Not REVIEWED.' })
  pengesahan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.pengesahan(id, dto, user.userId);
  }

  @Post('documents/:id/kaprodi-discussion')
  @HttpCode(HttpStatus.OK)
  @CheckPolicy('document:submit', 'document')
  @ApiConflictResponse({
    description: 'No open Kaprodi discussion step (LPJ, no event date, done).',
  })
  kaprodiDiscussion(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.documents.markKaprodiDiscussion(id, user.userId);
  }

  @Post('documents/:id/to-kaprodi')
  @HttpCode(HttpStatus.OK)
  @CheckPolicy('document:submit', 'document')
  @ApiConflictResponse({ description: 'Not APPROVED.' })
  toKaprodi(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.documents.toKaprodi(id, user.userId);
  }

  /** Multipart: `file`, the Kaprodi-signed PDF. */
  @Post('documents/:id/signed')
  @HttpCode(HttpStatus.OK)
  @CheckPolicy('document:submit', 'document')
  @UseInterceptors(SingleFileInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBadRequestResponse({ description: 'No file, or not a PDF.' })
  @ApiPayloadTooLargeResponse({ description: 'File larger than 10 MB.' })
  @ApiConflictResponse({ description: 'Not AT_KAPRODI.' })
  sign(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.documents.sign(id, file, user.userId);
  }

  @Post('documents/:id/archive')
  @HttpCode(HttpStatus.OK)
  @CheckPolicy('document:archive', 'document')
  @ApiConflictResponse({ description: 'Not SIGNED.' })
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.documents.archive(id, user.userId);
  }
}

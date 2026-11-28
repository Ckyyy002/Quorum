import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiPayloadTooLargeResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { CheckPolicy } from '../policy/check-policy.decorator';
import { EvidenceDto } from '../upload/evidence.dto';
import { SingleFileInterceptor } from '../upload/file-interceptor';
import {
  AssignProkerDto,
  ChangeProkerStatusDto,
  CreateProkerDto,
  ListProkersQueryDto,
  SetCommitteeDto,
  EvaluationDto,
  TickChecklistDto,
  UpdateChecklistItemDto,
  UpdateProkerDto,
} from './dto/proker.dto';
import { ProkerService } from './proker.service';

@ApiTags('proker')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiNotFoundResponse({ description: 'Proker, department, biro or membership not found.' })
@Controller()
export class ProkerController {
  constructor(private readonly prokers: ProkerService) {}

  /** Public summary of the active period's proker (US-3.8); open to every logged-in user. */
  @Get('prokers')
  list(@Query() query: ListProkersQueryDto) {
    return this.prokers.list(query);
  }

  @Post('departments/:id/prokers')
  @CheckPolicy('proker:manage', 'department')
  @ApiBadRequestResponse({ description: 'Biro or PIC outside the department.' })
  @ApiConflictResponse({ description: 'Name already used in the department.' })
  create(
    @Param('id', ParseUUIDPipe) departmentId: string,
    @Body() dto: CreateProkerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.prokers.create(departmentId, dto, user.userId);
  }

  @Get('prokers/:id')
  @CheckPolicy('proker:view', 'proker')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.prokers.get(id);
  }

  @Get('prokers/:id/members')
  @CheckPolicy('proker:view', 'proker')
  members(@Param('id', ParseUUIDPipe) id: string) {
    return this.prokers.members(id);
  }

  @Patch('prokers/:id')
  @CheckPolicy('proker:edit', 'proker')
  @ApiConflictResponse({ description: 'Name already used in the department.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProkerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.prokers.update(id, dto, user.userId);
  }

  @Patch('prokers/:id/assignment')
  @CheckPolicy('proker:manage', 'proker')
  @ApiBadRequestResponse({ description: 'Biro or PIC outside the department.' })
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignProkerDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.prokers.assign(id, dto, user.userId);
  }

  @Delete('prokers/:id')
  @CheckPolicy('proker:manage', 'proker')
  @ApiConflictResponse({ description: 'The proposal is already approved.' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.prokers.remove(id, user.userId);
  }

  @Post('prokers/:id/status')
  @HttpCode(HttpStatus.OK)
  @CheckPolicy('proker:status', 'proker')
  @ApiBadRequestResponse({ description: 'Transition not allowed, or cancelling without a reason.' })
  @ApiConflictResponse({ description: 'DONE before the LPJ is in review.' })
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeProkerStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.prokers.changeStatus(id, dto, user.userId);
  }

  /** US-3.10: fill or edit the evaluation; also ticks the checklist's evaluation item. */
  @Put('prokers/:id/evaluation')
  @CheckPolicy('proker:evaluate', 'proker')
  @ApiBadRequestResponse({ description: 'A text field is empty or the feedback link is invalid.' })
  @ApiConflictResponse({ description: 'Before the event date (or no event date yet).' })
  saveEvaluation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EvaluationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.prokers.saveEvaluation(id, dto, user.userId);
  }

  @Post('prokers/:id/checklist/:key/tick')
  @HttpCode(HttpStatus.OK)
  @CheckPolicy('checklist:tick', 'proker')
  @ApiBadRequestResponse({ description: 'No evidence: send evidenceUrl or attach a file first.' })
  tick(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('key') key: string,
    @Body() dto: TickChecklistDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.prokers.tick(id, key, dto, user.userId);
  }

  /** Multipart: `evidenceUrl` and/or `file` (JPG, PNG, WebP, PDF, DOCX, XLSX, PPTX; max 10 MB). */
  @Put('prokers/:id/checklist/:key/evidence')
  @CheckPolicy('checklist:tick', 'proker')
  @UseInterceptors(SingleFileInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBadRequestResponse({
    description: 'Neither link nor file, invalid link, or file type not allowed.',
  })
  @ApiPayloadTooLargeResponse({ description: 'File larger than 10 MB.' })
  setChecklistEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('key') key: string,
    @Body() dto: EvidenceDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.prokers.setChecklistEvidence(id, key, dto, file, user.userId);
  }

  @Get('prokers/:id/checklist/:key/evidence/file')
  @CheckPolicy('proker:view', 'proker')
  async checklistEvidenceFile(@Param('id', ParseUUIDPipe) id: string, @Param('key') key: string) {
    const { stream, ...headers } = await this.prokers.checklistEvidenceFile(id, key);
    return new StreamableFile(stream, headers);
  }

  @Delete('prokers/:id/checklist/:key/tick')
  @CheckPolicy('checklist:tick', 'proker')
  untick(@Param('id', ParseUUIDPipe) id: string, @Param('key') key: string) {
    return this.prokers.untick(id, key);
  }

  @Patch('prokers/:id/checklist/:key')
  @CheckPolicy('checklist:tick', 'proker')
  @ApiBadRequestResponse({ description: 'Empty label, impossible day or invalid URL.' })
  editChecklistItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('key') key: string,
    @Body() dto: UpdateChecklistItemDto,
  ) {
    return this.prokers.editChecklistItem(id, key, dto);
  }

  @Put('prokers/:id/committee')
  @CheckPolicy('committee:set', 'proker')
  @ApiBadRequestResponse({
    description:
      'Duplicate member, PIC listed again, KADIV without division, or not in the department.',
  })
  setCommittee(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCommitteeDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.prokers.setCommittee(id, dto, user.userId);
  }
}

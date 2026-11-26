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
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { CheckPolicy } from '../policy/check-policy.decorator';
import { EvidenceDto } from '../upload/evidence.dto';
import { SingleFileInterceptor } from '../upload/file-interceptor';
import {
  ChangeTaskStatusDto,
  CreateTaskDto,
  ListProkerTasksQueryDto,
  MyTasksQueryDto,
  UpdateTaskDto,
} from './dto/task.dto';
import { TaskService } from './task.service';

@ApiTags('task')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@ApiNotFoundResponse({ description: 'Proker, task or membership not found.' })
@Controller()
export class TaskController {
  constructor(private readonly tasks: TaskService) {}

  @Get('me/tasks')
  mine(@CurrentUser() user: AuthUser, @Query() query: MyTasksQueryDto) {
    return this.tasks.mine(user.userId, query);
  }

  @Get('prokers/:id/tasks')
  @CheckPolicy('proker:view', 'proker')
  list(@Param('id', ParseUUIDPipe) prokerId: string, @Query() query: ListProkerTasksQueryDto) {
    return this.tasks.listForProker(prokerId, query);
  }

  @Post('prokers/:id/tasks')
  @CheckPolicy('task:manage', 'proker')
  @ApiBadRequestResponse({
    description: 'Deadline in the past, or assignee outside the department.',
  })
  create(
    @Param('id', ParseUUIDPipe) prokerId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasks.create(prokerId, dto, user.userId);
  }

  @Patch('tasks/:id')
  @CheckPolicy('task:manage', 'task')
  @ApiBadRequestResponse({
    description: 'Deadline in the past, or assignee outside the department.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasks.update(id, dto, user.userId);
  }

  @Delete('tasks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckPolicy('task:manage', 'task')
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasks.remove(id);
  }

  /** Multipart: `evidenceUrl` and/or `file` (JPG, PNG, WebP, PDF, DOCX, XLSX, PPTX; max 10 MB). */
  @Put('tasks/:id/evidence')
  @CheckPolicy('task:status', 'task')
  @UseInterceptors(SingleFileInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBadRequestResponse({
    description: 'Neither link nor file, invalid link, or file type not allowed.',
  })
  @ApiPayloadTooLargeResponse({ description: 'File larger than 10 MB.' })
  setEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EvidenceDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasks.setEvidence(id, dto, file, user.userId);
  }

  @Get('tasks/:id/evidence/file')
  @CheckPolicy('proker:view', 'task')
  async evidenceFile(@Param('id', ParseUUIDPipe) id: string) {
    const { stream, ...headers } = await this.tasks.evidenceFile(id);
    return new StreamableFile(stream, headers);
  }

  @Post('tasks/:id/status')
  @HttpCode(HttpStatus.OK)
  @CheckPolicy('task:status', 'task')
  @ApiBadRequestResponse({
    description: 'Skipping a step (e.g. TODO → DONE), or DONE without evidence.',
  })
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeTaskStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasks.changeStatus(id, dto, user.userId);
  }
}

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
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { CheckPolicy } from '../policy/check-policy.decorator';
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

  @Post('tasks/:id/status')
  @HttpCode(HttpStatus.OK)
  @CheckPolicy('task:status', 'task')
  @ApiBadRequestResponse({ description: 'Skipping a step (e.g. TODO → DONE).' })
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeTaskStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasks.changeStatus(id, dto, user.userId);
  }
}

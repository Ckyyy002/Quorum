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
} from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { CheckPolicy } from '../policy/check-policy.decorator';
import { CreatePeriodDto, UpdatePeriodDto } from './dto/org.dto';
import { OrgService } from './org.service';

@ApiTags('org')
@ApiBearerAuth()
@Controller('periods')
export class PeriodsController {
  constructor(private readonly org: OrgService) {}

  /** Any member: the header's period switcher lists them. */
  @Get()
  list() {
    return this.org.listPeriods();
  }

  @Post()
  @CheckPolicy('org:manage')
  @ApiConflictResponse({ description: 'Name already used.' })
  create(@Body() dto: CreatePeriodDto) {
    return this.org.createPeriod(dto);
  }

  @Patch(':id')
  @CheckPolicy('org:manage')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePeriodDto) {
    return this.org.updatePeriod(id, dto);
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @CheckPolicy('org:manage')
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.org.activatePeriod(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckPolicy('org:manage')
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'Period still has departments or members.' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.org.deletePeriod(id);
  }

  /** Any member: the organization tree is not secret. */
  @Get(':id/structure')
  structure(@Param('id', ParseUUIDPipe) id: string) {
    return this.org.structure(id);
  }
}

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
import { ApiBearerAuth, ApiConflictResponse, ApiTags } from '@nestjs/swagger';
import { CheckPolicy } from '../policy/check-policy.decorator';
import {
  CreateBiroDto,
  CreateDepartmentDto,
  UpdateBiroDto,
  UpdateDepartmentDto,
} from './dto/org.dto';
import { OrgService } from './org.service';

@ApiTags('org')
@ApiBearerAuth()
@Controller()
export class UnitsController {
  constructor(private readonly org: OrgService) {}

  @Post('departments')
  @CheckPolicy('org:manage')
  @ApiConflictResponse({ description: 'Code already used in this period.' })
  createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.org.createDepartment(dto);
  }

  @Patch('departments/:id')
  @CheckPolicy('org:manage')
  updateDepartment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDepartmentDto) {
    return this.org.updateDepartment(id, dto);
  }

  @Delete('departments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckPolicy('org:manage')
  @ApiConflictResponse({ description: 'Department still has biros, members, proker or meetings.' })
  deleteDepartment(@Param('id', ParseUUIDPipe) id: string) {
    return this.org.deleteDepartment(id);
  }

  @Get('departments/:id/overview')
  @CheckPolicy('department:overview', 'department')
  departmentOverview(@Param('id', ParseUUIDPipe) id: string) {
    return this.org.departmentOverview(id);
  }

  @Post('departments/:id/biros')
  @CheckPolicy('org:manage')
  @ApiConflictResponse({ description: 'Code already used in this department.' })
  createBiro(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateBiroDto) {
    return this.org.createBiro(id, dto);
  }

  @Patch('biros/:id')
  @CheckPolicy('org:manage')
  updateBiro(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBiroDto) {
    return this.org.updateBiro(id, dto);
  }

  @Delete('biros/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckPolicy('org:manage')
  @ApiConflictResponse({ description: 'Biro still has members, proker or meetings.' })
  deleteBiro(@Param('id', ParseUUIDPipe) id: string) {
    return this.org.deleteBiro(id);
  }

  @Get('kesekjenan/:id/overview')
  @CheckPolicy('kesekjenan:overview', 'kesekjenan')
  kesekjenanOverview(@Param('id', ParseUUIDPipe) id: string) {
    return this.org.kesekjenanOverview(id);
  }
}

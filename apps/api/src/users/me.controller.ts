import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
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
  ApiOkResponse,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { PaginationQueryDto } from '../common/pagination';
import { CheckPolicy } from '../policy/check-policy.decorator';
import { AvatarFileInterceptor } from '../upload/file-interceptor';
import { UpdateMeDto } from './dto/update-me.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller()
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOkResponse({
    description: 'Profile plus active membership (position, role group, units, PIC proker).',
  })
  getMe(@CurrentUser() user: AuthUser) {
    return this.users.getMe(user.userId);
  }

  /** US-1.5 AC1: name and NRP; the email cannot change (400 if sent). */
  @Patch('me')
  @ApiBadRequestResponse({ description: 'Invalid name or NRP, or an email in the body.' })
  @ApiConflictResponse({ description: 'The NRP belongs to another account.' })
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto) {
    return this.users.updateMe(user.userId, dto);
  }

  /** US-1.5 AC2: multipart `file`, JPG/PNG/WebP up to 2 MB; replaces the old picture. */
  @Put('me/avatar')
  @UseInterceptors(AvatarFileInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBadRequestResponse({ description: 'No file, or not a JPG/PNG/WebP image.' })
  @ApiPayloadTooLargeResponse({ description: 'Larger than 2 MB.' })
  setAvatar(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.users.setAvatar(user.userId, file);
  }

  /** Any logged-in user may see a member's picture. */
  @Get('users/:id/avatar')
  @ApiNotFoundResponse({ description: 'Unknown user, or no picture.' })
  async avatar(@Param('id', ParseUUIDPipe) id: string) {
    const { stream, ...headers } = await this.users.avatar(id);
    return new StreamableFile(stream, headers);
  }

  @Get('users')
  @CheckPolicy('org:manage')
  search(@Query() query: PaginationQueryDto) {
    return this.users.search(query);
  }
}

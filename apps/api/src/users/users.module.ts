import { Module } from '@nestjs/common';
import { UploadModule } from '../upload/upload.module';
import { OrgModule } from '../org/org.module';
import { MeController } from './me.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [OrgModule, UploadModule],
  controllers: [MeController],
  providers: [UsersRepository, UsersService],
  exports: [UsersRepository],
})
export class UsersModule {}

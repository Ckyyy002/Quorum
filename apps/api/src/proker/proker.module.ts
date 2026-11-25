import { Module } from '@nestjs/common';
import { ProkerController } from './proker.controller';
import { ProkerRepository } from './proker.repository';
import { ProkerService } from './proker.service';

/** Proker, their PIC and executing biro, status, committee and checklist. */
@Module({
  controllers: [ProkerController],
  providers: [ProkerRepository, ProkerService],
})
export class ProkerModule {}

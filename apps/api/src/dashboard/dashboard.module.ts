import { Module } from '@nestjs/common';
import { ProkerModule } from '../proker/proker.module';
import { DashboardController } from './dashboard.controller';
import { DashboardRepository } from './dashboard.repository';
import { DashboardService } from './dashboard.service';

/** US-9 dashboards. Reads only; proker progress comes from ProkerService so it is computed one way. */
@Module({
  imports: [ProkerModule],
  controllers: [DashboardController],
  providers: [DashboardRepository, DashboardService],
})
export class DashboardModule {}

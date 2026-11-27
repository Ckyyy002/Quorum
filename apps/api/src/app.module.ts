import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';
import { HealthController } from './health/health.controller';
import { OrgModule } from './org/org.module';
import { PolicyModule } from './policy/policy.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProkerModule } from './proker/proker.module';
import { TaskModule } from './task/task.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DocumentModule } from './document/document.module';
import { MeetingModule } from './meeting/meeting.module';
import { NotificationModule } from './notification/notification.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    PolicyModule,
    OrgModule,
    UsersModule,
    ProkerModule,
    TaskModule,
    DocumentModule,
    MeetingModule,
    NotificationModule,
    DashboardModule,
    AuthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

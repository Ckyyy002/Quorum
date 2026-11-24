import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/** The only gateway to the database; injected into repositories, never into controllers. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService) {
    // Prisma 7 talks to Postgres through a driver adapter (node-postgres) instead of a Rust engine.
    super({
      adapter: new PrismaPg({ connectionString: config.getOrThrow<string>('DATABASE_URL') }),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

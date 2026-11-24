import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupApp } from './setup-app.js';

const app = await NestFactory.create(AppModule);
setupApp(app);
await app.listen(app.get(ConfigService).getOrThrow<number>('PORT'));

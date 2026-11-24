import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupApp } from './setup-app';

// Wrapped in a function: CommonJS has no top-level await.
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  setupApp(app);
  await app.listen(app.get(ConfigService).getOrThrow<number>('PORT'));
}

void bootstrap();

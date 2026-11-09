import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import type { ApiEnv } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  configureApp(app);

  const configService = app.get<ConfigService<ApiEnv, true>>(ConfigService);
  const port = configService.get('PORT', { infer: true });

  await app.listen(port, '127.0.0.1');
  logger.log(`STAS-RG API berjalan di http://127.0.0.1:${String(port)}/api/v1`);
}

void bootstrap();

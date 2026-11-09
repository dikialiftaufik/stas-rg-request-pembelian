import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import type { ApiEnv } from './config/env.schema';

/** Impor data Pembelian Barang (maks. 1.000 baris dengan tautan panjang) melebihi default 100 KB. */
const JSON_BODY_LIMIT = '5mb';

export function configureApp(app: INestApplication): void {
  const configService = app.get<ConfigService<ApiEnv, true>>(ConfigService);
  const corsOrigins = configService.get('CORS_ORIGINS', { infer: true });

  app.setGlobalPrefix('api/v1');
  const expressApp = app as Partial<NestExpressApplication>;
  if (typeof expressApp.useBodyParser === 'function') {
    expressApp.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  }
  app.use(cookieParser());
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'X-Requested-With'],
  });
  app.enableShutdownHooks();
}

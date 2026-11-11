import './instrument';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { buildOpenApiDocument } from '@platform/http/openapi';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { APP_OPTIONS, configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    ...APP_OPTIONS,
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  configureApp(app);
  SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app));
  await app.listen(app.get<Env>(ENV).PORT);
}
void bootstrap();

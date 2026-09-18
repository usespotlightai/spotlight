import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { buildOpenApiDocument } from '@platform/http/openapi';
import { startWork } from '@work/work.startup';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // better-auth reads the raw request body itself.
    bodyParser: false,
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  configureApp(app);
  SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app));
  await app.listen(app.get<Env>(ENV).PORT);
  startWork(app);
}
bootstrap();

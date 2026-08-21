import { env } from '@infrastructure/config/env';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { buildOpenApiDocument } from '@presentation/http/openapi';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // better-auth reads the raw request body itself.
    bodyParser: false,
    // Holds Nest's own boot logs until the pino logger is installed below.
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  configureApp(app);
  SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app));
  await app.listen(env.PORT);
}
bootstrap();

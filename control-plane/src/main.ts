import { env } from '@infrastructure/config/env';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { buildOpenApiDocument } from '@presentation/http/openapi';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  // better-auth reads the raw request body itself.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  configureApp(app);
  SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app));
  await app.listen(env.PORT);
}
bootstrap();

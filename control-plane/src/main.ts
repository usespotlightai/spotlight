import { env } from '@infrastructure/config/env';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { buildOpenApiDocument } from '@presentation/http/openapi';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  SwaggerModule.setup('docs', app, buildOpenApiDocument(app));
  await app.listen(env.PORT);
}
bootstrap();

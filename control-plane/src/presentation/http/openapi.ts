import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export const openApiConfig = new DocumentBuilder()
  .setTitle('Spotlight Control Plane')
  .setDescription('HTTP API for the Spotlight Control Plane.')
  .setVersion('0.0.1')
  .addServer('/api')
  .build();

export const buildOpenApiDocument = (app: INestApplication): OpenAPIObject =>
  SwaggerModule.createDocument(app, openApiConfig);

import type { INestApplication } from '@nestjs/common';

export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  return app;
}

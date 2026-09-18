import type { INestApplication } from '@nestjs/common';
import { API_PREFIX } from '@platform/http/routes';

export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();

  return app;
}

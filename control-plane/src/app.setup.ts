import type { INestApplication } from '@nestjs/common';
import { traceOfRequest } from '@platform/errors/trace-of-request';
import { API_PREFIX } from '@platform/http/routes';

export function configureApp(app: INestApplication): INestApplication {
  app.use(traceOfRequest);
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();

  return app;
}

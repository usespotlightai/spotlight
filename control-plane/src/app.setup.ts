import type { INestApplication } from '@nestjs/common';
import { traceOfRequest } from '@platform/errors/trace-of-request';
import { API_PREFIX } from '@platform/http/routes';
import { routeOfRequest } from '@platform/telemetry/route-of-request';

export function configureApp(app: INestApplication): INestApplication {
  app.use(traceOfRequest);
  app.use(routeOfRequest);
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();

  return app;
}

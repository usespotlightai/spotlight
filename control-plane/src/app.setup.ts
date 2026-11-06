import type { INestApplication } from '@nestjs/common';
import { traceOfRequest } from '@platform/errors/trace-of-request';
import { largeBodies } from '@platform/http/large-bodies';
import { API_PREFIX } from '@platform/http/routes';
import { securityHeaders } from '@platform/http/security-headers';
import { routeOfRequest } from '@platform/telemetry/route-of-request';

export function configureApp(app: INestApplication): INestApplication {
  app.use(securityHeaders);
  app.use(traceOfRequest);
  app.use(routeOfRequest);
  app.use(largeBodies);
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();

  return app;
}

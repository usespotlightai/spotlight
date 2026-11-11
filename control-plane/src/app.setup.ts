import type { INestApplication, NestApplicationOptions } from '@nestjs/common';
import { traceOfRequest } from '@platform/errors/trace-of-request';
import { largeBodiesOf } from '@platform/http/large-bodies';
import { API_PREFIX } from '@platform/http/routes';
import { securityHeaders } from '@platform/http/security-headers';
import { routeOfRequest } from '@platform/telemetry/route-of-request';

export const APP_OPTIONS = {
  // better-auth reads the raw request body itself.
  bodyParser: false,
  return503OnClosing: true,
} satisfies NestApplicationOptions;

export function configureApp(app: INestApplication): INestApplication {
  app.use(securityHeaders);
  app.use(traceOfRequest);
  app.use(routeOfRequest);
  app.use(largeBodiesOf(app));
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();

  return app;
}

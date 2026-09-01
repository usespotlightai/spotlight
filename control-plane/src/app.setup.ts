import type { INestApplication } from '@nestjs/common';

export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  // Without these, nothing written to run at shutdown ever runs: the pool is
  // left open, and whatever is in flight is cut off wherever it happened to be.
  app.enableShutdownHooks();

  return app;
}

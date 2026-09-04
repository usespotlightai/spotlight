import {
  RUN_DIGEST_WRITER,
  type RunDigestWriterPort,
} from '@application/ports/run-digest-writer.port';
import { SettleSetup } from '@application/services/settle-setup.service';
import type { INestApplication } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  // Without these, nothing written to run at shutdown ever runs: the pool is
  // left open, and whatever is in flight is cut off wherever it happened to be.
  app.enableShutdownHooks();

  return app;
}

/**
 * Work the control plane owes itself once it is up: outcomes kept for runs
 * that ended before anything was keeping them, and setup lists whose settling
 * moment was missed. Detached, so neither holds up serving.
 */
export function startBackgroundWork(app: INestApplication): void {
  const digests = app.get<RunDigestWriterPort>(RUN_DIGEST_WRITER);

  void digests.catchUp().catch((error: unknown) => {
    app.get(Logger).error(error, 'catching up run digests');
  });

  void app
    .get(SettleSetup)
    .wherever()
    .catch((error: unknown) => {
      app.get(Logger).error(error, 'settling setup lists');
    });
}

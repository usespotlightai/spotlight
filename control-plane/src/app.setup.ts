import {
  RUN_DIGEST_WRITER,
  type RunDigestWriterPort,
} from '@application/ports/run-digest-writer.port';
import type { INestApplication } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api');
  return app;
}

/**
 * Work the control plane owes itself once it is up. Runs that ended before
 * their outcome was being kept are caught up here rather than by whoever
 * happens to read a trace first — reading one must never write one.
 *
 * Detached: a long history does not hold up serving, and its failure is its
 * own. Resolved from the container because this is the composition root, which
 * is the one place that is allowed to know how a port is satisfied.
 */
export function startBackgroundWork(app: INestApplication): void {
  const digests = app.get<RunDigestWriterPort>(RUN_DIGEST_WRITER);

  void digests.catchUp().catch((error: unknown) => {
    app.get(Logger).error(error, 'catching up run digests');
  });
}

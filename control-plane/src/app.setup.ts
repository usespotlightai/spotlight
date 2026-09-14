import {
  RUN_DIGEST_WRITER,
  type RunDigestWriterPort,
} from '@application/ports/run-digest-writer.port';
import { SettleSetup } from '@application/services/settle-setup.service';
import type { INestApplication } from '@nestjs/common';
import { API_PREFIX } from '@presentation/http/routes';
import { Logger } from 'nestjs-pino';

export function configureApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();

  return app;
}

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

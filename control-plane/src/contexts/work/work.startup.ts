import type { INestApplication } from '@nestjs/common';
import {
  RUN_DIGEST_WRITER,
  type RunDigestWriterPort,
} from '@work/application/ports/run-digest-writer.port';
import { SettleSetup } from '@work/application/services/settle-setup.service';
import { Logger } from 'nestjs-pino';

export function startWork(app: INestApplication): void {
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

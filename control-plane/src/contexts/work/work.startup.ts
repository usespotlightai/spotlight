import type { INestApplication } from '@nestjs/common';
import {
  RUN_USAGE_WRITER,
  type RunUsageWriterPort,
} from '@work/application/ports/run-usage-writer.port';
import { ReconcileSetup } from '@work/application/services/reconcile-setup.service';
import { Logger } from 'nestjs-pino';

export function startWork(app: INestApplication): void {
  const usages = app.get<RunUsageWriterPort>(RUN_USAGE_WRITER);

  void usages.catchUp().catch((error: unknown) => {
    app.get(Logger).error(error, 'catching up run usages');
  });

  void app
    .get(ReconcileSetup)
    .wherever()
    .catch((error: unknown) => {
      app.get(Logger).error(error, 'reconciling setup lists');
    });
}

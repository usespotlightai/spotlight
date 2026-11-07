import type { OnApplicationBootstrap, Provider } from '@nestjs/common';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import {
  RUN_USAGE_WRITER,
  type RunUsageWriterPort,
} from '@work/application/ports/run-usage-writer.port';
import { ReconcileSetup } from '@work/application/services/reconcile-setup.service';

export class WorkStartup implements OnApplicationBootstrap {
  constructor(
    private readonly usages: RunUsageWriterPort,
    private readonly setup: ReconcileSetup,
    private readonly logger: LoggerPort,
  ) {}

  onApplicationBootstrap(): void {
    void this.usages.catchUp().catch((error: unknown) => {
      this.logger.error({ err: error }, 'catching up run usages');
    });

    void this.setup.wherever().catch((error: unknown) => {
      this.logger.error({ err: error }, 'reconciling setup lists');
    });
  }
}

export const WORK_STARTUP: Provider = {
  provide: WorkStartup,
  inject: [RUN_USAGE_WRITER, ReconcileSetup, LOGGER],
  useFactory: (
    usages: RunUsageWriterPort,
    setup: ReconcileSetup,
    logger: LoggerPort,
  ) => new WorkStartup(usages, setup, logger),
};

import type { OnApplicationBootstrap, Provider } from '@nestjs/common';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import { ReconcileSetup } from '@work/application/services/reconcile-setup.service';

export class WorkStartup implements OnApplicationBootstrap {
  constructor(
    private readonly setup: ReconcileSetup,
    private readonly logger: LoggerPort,
  ) {}

  onApplicationBootstrap(): void {
    void this.setup.wherever().catch((error: unknown) => {
      this.logger.error({ err: error }, 'reconciling setup lists');
    });
  }
}

export const WORK_STARTUP: Provider = {
  provide: WorkStartup,
  inject: [ReconcileSetup, LOGGER],
  useFactory: (setup: ReconcileSetup, logger: LoggerPort) =>
    new WorkStartup(setup, logger),
};

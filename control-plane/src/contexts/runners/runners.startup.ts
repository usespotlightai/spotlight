import type { OnApplicationBootstrap, Provider } from '@nestjs/common';
import { ManagedPools } from '@runners/application/services/managed-pools.service';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';

class RunnersStartup implements OnApplicationBootstrap {
  constructor(
    private readonly managed: ManagedPools,
    private readonly logger: LoggerPort,
  ) {}

  onApplicationBootstrap(): void {
    void this.managed.reconcile().catch((error: unknown) => {
      this.logger.error({ err: error }, 'Reconciling the managed runner pools');
    });
  }
}

export const RUNNERS_STARTUP: Provider = {
  provide: RunnersStartup,
  inject: [ManagedPools, LOGGER],
  useFactory: (managed: ManagedPools, logger: LoggerPort) =>
    new RunnersStartup(managed, logger),
};

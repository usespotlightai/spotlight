import type { OnApplicationBootstrap, Provider } from '@nestjs/common';
import { PlatformPools } from '@runners/application/services/platform-pools.service';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';

class RunnersStartup implements OnApplicationBootstrap {
  constructor(
    private readonly platformPools: PlatformPools,
    private readonly logger: LoggerPort,
  ) {}

  onApplicationBootstrap(): void {
    void this.platformPools.reconcile().catch((error: unknown) => {
      this.logger.error(
        { err: error },
        'Reconciling the platform runner pools',
      );
    });
  }
}

export const RUNNERS_STARTUP: Provider = {
  provide: RunnersStartup,
  inject: [PlatformPools, LOGGER],
  useFactory: (platformPools: PlatformPools, logger: LoggerPort) =>
    new RunnersStartup(platformPools, logger),
};

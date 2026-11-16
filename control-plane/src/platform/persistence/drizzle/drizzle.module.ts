import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import { ConfigModule } from '@platform/config/config.module';
import { LoggingModule } from '@platform/logging/logging.module';
import {
  attachPoolErrorHandler,
  createDatabase,
  createPool,
  createReadPool,
} from '@platform/persistence/drizzle/drizzle.client';
import {
  DRIZZLE,
  PG_POOL,
  READ_DRIZZLE,
  READ_PG_POOL,
} from '@platform/persistence/drizzle/drizzle.constants';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import {
  TELEMETRY,
  type TelemetryPort,
} from '@shared-kernel/application/ports/telemetry.port';
import type { Env } from '@platform/config/env.schema';
import type { Pool } from 'pg';

@Module({
  imports: [ConfigModule, LoggingModule],
  providers: [
    {
      provide: PG_POOL,
      inject: [ENV, LOGGER, TELEMETRY],
      useFactory: (env: Env, logger: LoggerPort, telemetry: TelemetryPort) =>
        attachPoolErrorHandler(createPool(env), 'primary', logger, telemetry),
    },
    { provide: DRIZZLE, useFactory: createDatabase, inject: [PG_POOL] },
    {
      provide: READ_PG_POOL,
      inject: [ENV, PG_POOL, LOGGER, TELEMETRY],
      useFactory: (
        env: Env,
        pool: Pool,
        logger: LoggerPort,
        telemetry: TelemetryPort,
      ) => {
        const read = createReadPool(env, pool);
        return read === pool
          ? pool
          : attachPoolErrorHandler(read, 'read', logger, telemetry);
      },
    },
    {
      provide: READ_DRIZZLE,
      useFactory: createDatabase,
      inject: [READ_PG_POOL],
    },
  ],
  exports: [DRIZZLE, PG_POOL, READ_DRIZZLE],
})
export class DrizzleModule implements OnApplicationShutdown {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(READ_PG_POOL) private readonly readPool: Pool,
  ) {}

  // Close the pool on shutdown, not on destroy. Destroy hooks run when the app still serves requests.
  async onApplicationShutdown(): Promise<void> {
    await Promise.all(
      [...new Set([this.pool, this.readPool])].map((each) => each.end()),
    );
  }
}

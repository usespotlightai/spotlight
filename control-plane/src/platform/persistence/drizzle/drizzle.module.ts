import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import { ConfigModule } from '@platform/config/config.module';
import {
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
import type { Pool } from 'pg';

@Module({
  imports: [ConfigModule],
  providers: [
    { provide: PG_POOL, useFactory: createPool, inject: [ENV] },
    { provide: DRIZZLE, useFactory: createDatabase, inject: [PG_POOL] },
    {
      provide: READ_PG_POOL,
      useFactory: createReadPool,
      inject: [ENV, PG_POOL],
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

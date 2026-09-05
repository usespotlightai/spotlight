import { ENV } from '@infrastructure/config/config.constants';
import { ConfigModule } from '@infrastructure/config/config.module';
import {
  createDatabase,
  createPool,
  type DrizzleDatabase,
} from '@infrastructure/persistence/drizzle/drizzle.client';
import {
  DRIZZLE,
  PG_POOL,
} from '@infrastructure/persistence/drizzle/drizzle.constants';
import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import type { Pool } from 'pg';

export type { DrizzleDatabase };

@Module({
  imports: [ConfigModule],
  providers: [
    { provide: PG_POOL, useFactory: createPool, inject: [ENV] },
    { provide: DRIZZLE, useFactory: createDatabase, inject: [PG_POOL] },
  ],
  exports: [DRIZZLE, PG_POOL],
})
export class DrizzleModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Last of all, and deliberately: destroy hooks run before the server has
   * stopped answering, and a pool closed under a request in flight turns it
   * into a fault the caller did nothing to deserve.
   */
  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

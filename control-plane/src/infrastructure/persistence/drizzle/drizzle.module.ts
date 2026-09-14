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

  // On shutdown, not destroy: destroy hooks run while requests are still served.
  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}

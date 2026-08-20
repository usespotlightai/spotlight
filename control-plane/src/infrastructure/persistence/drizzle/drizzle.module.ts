import {
  type DrizzleDatabase,
  db,
  pool,
} from '@infrastructure/persistence/drizzle/drizzle.client';
import {
  DRIZZLE,
  PG_POOL,
} from '@infrastructure/persistence/drizzle/drizzle.constants';
import { Module, type OnModuleDestroy } from '@nestjs/common';

export type { DrizzleDatabase };

@Module({
  providers: [
    { provide: PG_POOL, useValue: pool },
    { provide: DRIZZLE, useValue: db },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await pool.end();
  }
}

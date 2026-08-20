import { env } from '@infrastructure/config/env';
import {
  DRIZZLE,
  PG_POOL,
} from '@infrastructure/persistence/drizzle/drizzle.constants';
import { Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export type DrizzleDatabase = NodePgDatabase;

@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (): Pool => new Pool({ connectionString: env.DATABASE_URL }),
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool): DrizzleDatabase => drizzle({ client: pool }),
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule implements OnModuleDestroy {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

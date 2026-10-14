import { Inject, Injectable } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { READ_DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { sql } from 'drizzle-orm';

@Injectable()
export class DrizzleReading {
  readonly #timeoutMs: string;

  constructor(
    @Inject(READ_DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(ENV) env: Env,
  ) {
    this.#timeoutMs = String(env.DATABASE_READ_TIMEOUT_MS);
  }

  read<T>(work: (db: DrizzleDatabase) => Promise<T>): Promise<T> {
    return this.db.transaction(
      async (tx) => {
        await tx.execute(
          sql`select set_config('statement_timeout', ${this.#timeoutMs}, true)`,
        );

        return work(tx as unknown as DrizzleDatabase);
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
  }
}

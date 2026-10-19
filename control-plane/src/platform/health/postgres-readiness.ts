import type { OnApplicationShutdown } from '@nestjs/common';
import {
  READINESS_TIMEOUT_MS,
  type ReadinessCheck,
} from '@platform/health/readiness-checks';
import { Pool } from 'pg';

export class PostgresReadiness
  implements ReadinessCheck, OnApplicationShutdown
{
  readonly name = 'postgres';

  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 1,
      connectionTimeoutMillis: READINESS_TIMEOUT_MS,
      query_timeout: READINESS_TIMEOUT_MS,
    });
    // The next check reports a dropped connection. Without a listener, it would end the process.
    this.pool.on('error', () => undefined);
  }

  async check(): Promise<void> {
    await this.pool.query('SELECT 1');
  }

  onApplicationShutdown(): Promise<void> {
    return this.pool.end();
  }
}

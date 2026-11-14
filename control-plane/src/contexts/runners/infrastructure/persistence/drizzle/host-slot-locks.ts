import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { HostSlotLocksPort } from '@runners/application/ports/host-slot-locks.port';
import { sql } from 'drizzle-orm';

@Injectable()
export class DrizzleHostSlotLocks implements HostSlotLocksPort {
  constructor(private readonly context: DrizzleContext) {}

  holding<T>(hostId: string, work: () => Promise<T>): Promise<T> {
    return this.context.inTransaction(async () => {
      await this.context.db.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`host-slots:${hostId}`}, 0))`,
      );

      return work();
    });
  }
}

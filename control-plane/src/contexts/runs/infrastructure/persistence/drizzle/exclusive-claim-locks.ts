import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { ExclusiveClaimLocksPort } from '@runs/application/ports/exclusive-claim-locks.port';
import type { RunRequester } from '@runs/domain/value-objects/run-requester.vo';
import { sql } from 'drizzle-orm';

@Injectable()
export class DrizzleExclusiveClaimLocks implements ExclusiveClaimLocksPort {
  constructor(private readonly context: DrizzleContext) {}

  claimingFor<T>(requester: RunRequester, work: () => Promise<T>): Promise<T> {
    return this.context.inTransaction(async () => {
      await this.context.db.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`exclusive-run-claim:${requester.id}`}, 0))`,
      );

      return work();
    });
  }
}

import type { ReviewingLocksPort } from '@change-review/application/ports/reviewing-locks.port';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { sql } from 'drizzle-orm';

@Injectable()
export class DrizzleReviewingLocks implements ReviewingLocksPort {
  constructor(private readonly context: DrizzleContext) {}

  signallingFor<T>(taskId: TaskId, work: () => Promise<T>): Promise<T> {
    return this.context.inTransaction(async () => {
      await this.context.db.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`reviewing-task:${taskId.value}`}, 0))`,
      );

      return work();
    });
  }
}

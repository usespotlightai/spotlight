import type { ChangeStackLocksPort } from '@change-review/application/ports/change-stack-locks.port';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { sql } from 'drizzle-orm';

@Injectable()
export class DrizzleChangeStackLocks implements ChangeStackLocksPort {
  constructor(private readonly context: DrizzleContext) {}

  stackingFor<T>(taskId: TaskId, work: () => Promise<T>): Promise<T> {
    return this.context.inTransaction(async () => {
      await this.context.db.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`change-stack-task:${taskId.value}`}, 0))`,
      );

      return work();
    });
  }
}

import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type {
  RunWaitsPort,
  WaitingRun,
} from '@runs/application/ports/run-waits.port';
import { runWait } from '@runs/infrastructure/persistence/drizzle/schemas/run.schema';
import { ne, or, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleRunWaits implements RunWaitsPort {
  constructor(private readonly context: DrizzleContext) {}

  // One write for every run of a tick. Keep in step with waitSince: the time stays while the reason and the queueing stay.
  async note(waiting: readonly WaitingRun[], at: Date): Promise<void> {
    const latest = new Map(waiting.map((each) => [each.runId.value, each]));

    if (latest.size === 0) {
      return;
    }

    await this.context.db
      .insert(runWait)
      .values(
        [...latest.values()].map((each) => ({
          runId: each.runId.value,
          reason: each.reason,
          queuedAt: each.queuedAt,
          since: at,
        })),
      )
      .onConflictDoUpdate({
        target: runWait.runId,
        set: {
          reason: sql`excluded.reason`,
          queuedAt: sql`excluded.queued_at`,
          since: sql`excluded.since`,
        },
        setWhere: or(
          ne(runWait.reason, sql`excluded.reason`),
          ne(runWait.queuedAt, sql`excluded.queued_at`),
        ),
      });
  }
}

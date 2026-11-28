import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type {
  RunWaitsPort,
  WaitingRun,
} from '@runs/application/ports/run-waits.port';
import { runWait } from '@runs/infrastructure/persistence/drizzle/schemas/run.schema';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { eq, ne, or, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleRunWaits implements RunWaitsPort {
  constructor(private readonly context: DrizzleContext) {}

  // One write for every run of a tick. The time stays while the reason and the queueing stay.
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
          quietHosts: each.quiet ? [...each.quiet.hosts] : null,
          quietSince: each.quiet?.since ?? null,
        })),
      )
      .onConflictDoUpdate({
        target: runWait.runId,
        set: {
          reason: sql`excluded.reason`,
          queuedAt: sql`excluded.queued_at`,
          // The quiet hosts can change while the reason stays, and the time stays with it.
          since: sql`case when ${runWait.reason} = excluded.reason and ${runWait.queuedAt} = excluded.queued_at then ${runWait.since} else excluded.since end`,
          quietHosts: sql`excluded.quiet_hosts`,
          quietSince: sql`excluded.quiet_since`,
        },
        setWhere: or(
          ne(runWait.reason, sql`excluded.reason`),
          ne(runWait.queuedAt, sql`excluded.queued_at`),
          sql`${runWait.quietHosts} is distinct from excluded.quiet_hosts`,
          sql`${runWait.quietSince} is distinct from excluded.quiet_since`,
        ),
      });
  }

  async clear(runId: RunId): Promise<void> {
    await this.context.db.delete(runWait).where(eq(runWait.runId, runId.value));
  }
}

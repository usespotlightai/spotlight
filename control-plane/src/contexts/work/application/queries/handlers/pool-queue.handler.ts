import type { RunnerPoolsPort } from '@runners/application/ports/runner-pools.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import type { PoolQueueDto } from '@work/application/dto/pool.dto';
import type { CheckWorkPort } from '@work/application/ports/check-work.port';
import type { QueuedPlacementsPort } from '@work/application/ports/queued-placements.port';
import type { PoolQueueQuery } from '@work/application/queries/pool.queries';
import { poolCouldTake } from '@work/domain/services/pool-fit';

export class PoolQueueHandler
  implements QueryHandlerPort<PoolQueueQuery, PoolQueueDto | null>
{
  constructor(
    private readonly pools: RunnerPoolsPort,
    private readonly queued: QueuedPlacementsPort,
    private readonly checks: CheckWorkPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(query: PoolQueueQuery): Promise<PoolQueueDto | null> {
    try {
      const pool = await this.pools.pulledWith(query.token, query.poolId);

      if (!pool) {
        return null;
      }

      const now = this.clock.now();
      const [runs, checks, running, room] = await Promise.all([
        this.queued.unclaimedIn(pool.workspaceId, now),
        this.checks.waitingPlacements(pool.workspaceId, now),
        this.pools.running(pool.poolId, now),
        this.pools.roomIn(pool.poolId, now),
      ]);
      const takeable = [...runs, ...checks].filter((each) =>
        poolCouldTake(each, pool.labels),
      );

      return {
        pending: takeable.length,
        running,
        capacity: room,
        labels: Object.fromEntries(
          pool.labels.values.map((label) => [
            label,
            takeable.filter((each) => each.selectors.includes(label)).length,
          ]),
        ),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { RunMovedOnError } from '@work/domain/exceptions/run-moved-on.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';

export class RunLeases {
  constructor(private readonly runs: RunRepository) {}

  async requeueLapsed(now: Date): Promise<readonly Run[]> {
    const requeued: Run[] = [];

    for (const lapsing of await this.runs.lapsedClaims(now)) {
      if (!lapsing.lapsed(now)) {
        continue;
      }

      const next = lapsing.requeue(now);

      if (await this.saved(next)) {
        requeued.push(next);
      }
    }

    return requeued;
  }

  async releaseHeldBy(runner: RunnerId): Promise<void> {
    for (const held of await this.runs.claimedBy(runner)) {
      await this.saved(held.release());
    }
  }

  private async saved(run: Run): Promise<boolean> {
    try {
      await this.runs.save(run);
      return true;
    } catch (error) {
      if (error instanceof RunMovedOnError) {
        return false;
      }
      throw error;
    }
  }
}

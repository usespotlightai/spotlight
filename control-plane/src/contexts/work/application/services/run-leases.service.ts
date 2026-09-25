import type { RunnersPort } from '@runners/application/ports/runners.port';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { RunMovedOnError } from '@work/domain/exceptions/run-moved-on.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';

export class RunLeases {
  constructor(
    private readonly runs: RunRepository,
    private readonly runners: RunnersPort,
  ) {}

  async requeueLapsed(now: Date): Promise<readonly Run[]> {
    const requeued: Run[] = [];

    for (const lapsing of await this.runs.lapsedClaims(now)) {
      if (!lapsing.lapsed(now)) {
        continue;
      }

      const next = lapsing.requeue(now);

      if (await this.saved(next)) {
        requeued.push(next);

        if (lapsing.claimedBy) {
          await this.runners.letGo(lapsing.claimedBy, now);
        }
      }
    }

    return requeued;
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

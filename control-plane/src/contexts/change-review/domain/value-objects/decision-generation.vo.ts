import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class DecisionGeneration {
  private constructor(
    readonly runId: RunId,
    readonly requestedAt: Date,
    readonly job: PendingJob,
  ) {}

  static requested(runId: RunId, now: Date): DecisionGeneration {
    return new DecisionGeneration(runId, now, PendingJob.fresh());
  }

  static rehydrate(input: {
    runId: RunId;
    requestedAt: Date;
    job: PendingJob;
  }): DecisionGeneration {
    return new DecisionGeneration(input.runId, input.requestedAt, input.job);
  }

  isFor(runId: RunId): boolean {
    return this.runId.equals(runId);
  }

  withJob(job: PendingJob): DecisionGeneration {
    return new DecisionGeneration(this.runId, this.requestedAt, job);
  }
}

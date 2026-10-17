import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class DecisionDraft {
  private constructor(
    readonly runId: RunId,
    readonly requestedAt: Date,
    readonly job: PendingJob,
  ) {}

  static requested(runId: RunId, now: Date): DecisionDraft {
    return new DecisionDraft(runId, now, PendingJob.fresh());
  }

  static rehydrate(input: {
    runId: RunId;
    requestedAt: Date;
    job: PendingJob;
  }): DecisionDraft {
    return new DecisionDraft(input.runId, input.requestedAt, input.job);
  }

  isFor(runId: RunId): boolean {
    return this.runId.equals(runId);
  }

  withJob(job: PendingJob): DecisionDraft {
    return new DecisionDraft(this.runId, this.requestedAt, job);
  }
}

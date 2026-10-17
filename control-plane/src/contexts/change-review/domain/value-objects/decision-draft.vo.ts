import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class DecisionDraft {
  private constructor(
    readonly runId: RunId,
    readonly askedAt: Date,
    readonly job: PendingJob,
  ) {}

  static asked(runId: RunId, now: Date): DecisionDraft {
    return new DecisionDraft(runId, now, PendingJob.fresh());
  }

  static rehydrate(input: {
    runId: RunId;
    askedAt: Date;
    job: PendingJob;
  }): DecisionDraft {
    return new DecisionDraft(input.runId, input.askedAt, input.job);
  }

  isFor(runId: RunId): boolean {
    return this.runId.equals(runId);
  }

  withJob(job: PendingJob): DecisionDraft {
    return new DecisionDraft(this.runId, this.askedAt, job);
  }
}

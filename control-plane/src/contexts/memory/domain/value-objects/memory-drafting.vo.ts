import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class MemoryDrafting {
  private constructor(
    readonly runId: RunId,
    readonly requestedAt: Date,
    readonly job: PendingJob,
  ) {}

  static requested(runId: RunId, now: Date): MemoryDrafting {
    return new MemoryDrafting(runId, now, PendingJob.fresh());
  }

  static rehydrate(input: {
    runId: RunId;
    requestedAt: Date;
    job: PendingJob;
  }): MemoryDrafting {
    return new MemoryDrafting(input.runId, input.requestedAt, input.job);
  }

  isFor(runId: RunId): boolean {
    return this.runId.equals(runId);
  }

  withJob(job: PendingJob): MemoryDrafting {
    return new MemoryDrafting(this.runId, this.requestedAt, job);
  }
}

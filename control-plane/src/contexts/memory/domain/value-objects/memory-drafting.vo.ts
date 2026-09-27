import { OwedWork } from '@shared-kernel/domain/value-objects/owed-work.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class MemoryDrafting {
  private constructor(
    readonly runId: RunId,
    readonly askedAt: Date,
    readonly work: OwedWork,
  ) {}

  static asked(runId: RunId, now: Date): MemoryDrafting {
    return new MemoryDrafting(runId, now, OwedWork.fresh());
  }

  static rehydrate(input: {
    runId: RunId;
    askedAt: Date;
    work: OwedWork;
  }): MemoryDrafting {
    return new MemoryDrafting(input.runId, input.askedAt, input.work);
  }

  isFor(runId: RunId): boolean {
    return this.runId.equals(runId);
  }

  withWork(work: OwedWork): MemoryDrafting {
    return new MemoryDrafting(this.runId, this.askedAt, work);
  }
}

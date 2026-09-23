import { OwedWork } from '@change-review/domain/value-objects/owed-work.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class DecisionDraft {
  private constructor(
    readonly runId: RunId,
    readonly askedAt: Date,
    readonly work: OwedWork,
  ) {}

  static asked(runId: RunId, now: Date): DecisionDraft {
    return new DecisionDraft(runId, now, OwedWork.fresh());
  }

  static rehydrate(input: {
    runId: RunId;
    askedAt: Date;
    work: OwedWork;
  }): DecisionDraft {
    return new DecisionDraft(input.runId, input.askedAt, input.work);
  }

  isFor(runId: RunId): boolean {
    return this.runId.equals(runId);
  }

  withWork(work: OwedWork): DecisionDraft {
    return new DecisionDraft(this.runId, this.askedAt, work);
  }
}

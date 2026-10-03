import type { ReviewsPort } from '@memory/application/ports/reviews.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TaskAsidesPort } from '@work/application/ports/task-asides.port';

const FORM = 'memories';

export class Reviews implements ReviewsPort {
  constructor(private readonly asides: TaskAsidesPort) {}

  raise(taskId: TaskId, runId: RunId): Promise<void> {
    return this.asides.raise({ taskId, form: FORM, about: runId.value });
  }

  settle(taskId: TaskId, runId: RunId): Promise<void> {
    return this.asides.settle({ taskId, form: FORM, about: runId.value });
  }

  reviewItemOf(taskId: TaskId, runId: RunId): Promise<string | null> {
    return this.asides.idOf({ taskId, form: FORM, about: runId.value });
  }
}

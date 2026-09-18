import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export interface AtHand {
  readonly run: Run;
  readonly task: Task | null;
}

export class RunAtHand {
  constructor(
    private readonly runs: RunRepository,
    private readonly tasks: TaskRepository,
  ) {}

  async heldBy(runId: string, runnerId: string): Promise<AtHand> {
    const run = await this.runs.findById(RunId.of(runId));

    if (!run) {
      throw new UnknownRunError(`there is no run ${runId}`);
    }

    run.assertHeldBy(RunnerId.of(runnerId));

    return { run, task: run.taskId ? await this.tasks.find(run.taskId) : null };
  }
}

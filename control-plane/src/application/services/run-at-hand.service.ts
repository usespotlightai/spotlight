import type { Run } from '@domain/aggregates/run.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import { UnknownRunError } from '@domain/exceptions/unknown-run.error';
import type { RunRepository } from '@domain/repositories/run.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';

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

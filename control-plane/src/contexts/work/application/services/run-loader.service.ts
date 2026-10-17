import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export interface LoadedRun {
  readonly run: Run;
  readonly task: Task | null;
}

export class RunLoader {
  constructor(
    private readonly runs: RunRepository,
    private readonly tasks: TaskRepository,
  ) {}

  async forRunner(runId: string, runnerId: string): Promise<LoadedRun> {
    const run = await this.runs.findById(RunId.of(runId));

    if (!run) {
      throw new UnknownRunError(`Run ${runId} not found.`);
    }

    run.assertLeasedBy(RunnerId.of(runnerId));

    return { run, task: run.taskId ? await this.tasks.find(run.taskId) : null };
  }
}

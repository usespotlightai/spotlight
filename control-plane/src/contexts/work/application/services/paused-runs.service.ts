import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TaskAnswered } from '@work/domain/events/task-answered.event';
import { RunMovedOnError } from '@work/domain/exceptions/run-moved-on.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

const ATTEMPTS = 3;

export class PausedRuns {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly runs: RunRepository,
  ) {}

  onTaskAnswered(event: TaskAnswered): Promise<void> {
    return this.takeUp(event.taskId, event.heldBy);
  }

  async takeUp(taskId: TaskId, runId: RunId): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      const task = await this.tasks.find(taskId);
      const run = task?.takesUp(runId) ? await this.runs.findById(runId) : null;

      if (!run?.resumable) {
        return;
      }

      try {
        await this.runs.save(run.resumed());
        return;
      } catch (error) {
        if (!(error instanceof RunMovedOnError) || attempt >= ATTEMPTS) {
          throw error;
        }
      }
    }
  }
}

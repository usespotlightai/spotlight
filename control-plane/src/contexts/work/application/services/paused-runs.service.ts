import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TaskAnswered } from '@work/domain/events/task-answered.event';
import { RunVersionConflictError } from '@work/domain/exceptions/run-version-conflict.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { runCheckoutsFor } from '@work/domain/services/task-checkouts';

const ATTEMPTS = 3;

export class PausedRuns {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly runs: RunRepository,
    private readonly lines: LineRepository,
  ) {}

  onTaskAnswered(event: TaskAnswered): Promise<void> {
    return this.takeUp(event.taskId, event.currentRunId);
  }

  async takeUp(taskId: TaskId, runId: RunId): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      const task = await this.tasks.find(taskId);
      const run = task?.takesUp(runId) ? await this.runs.findById(runId) : null;

      if (!task || !run?.resumable) {
        return;
      }

      const line = run.stationId
        ? await this.lines.findByStation(run.stationId)
        : null;
      const joining = line ? runCheckoutsFor(task, line) : [];

      try {
        await this.runs.save(run.resumed(joining));
        return;
      } catch (error) {
        if (
          !(error instanceof RunVersionConflictError) ||
          attempt >= ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }
}

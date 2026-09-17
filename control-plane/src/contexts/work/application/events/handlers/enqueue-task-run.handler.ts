import type { DispatchTask } from '@work/application/services/dispatch-task.service';
import type { TaskHandedToRun } from '@work/domain/events/task-handed-to-run.event';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';

export class EnqueueTaskRun {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
    private readonly runs: RunRepository,
    private readonly dispatching: DispatchTask,
  ) {}

  async on(event: TaskHandedToRun): Promise<void> {
    const task = await this.tasks.find(event.taskId);

    if (!task?.currentRunId?.equals(event.runId)) {
      return;
    }

    if (await this.runs.findById(event.runId)) {
      return;
    }

    const line = await this.lines.holding(task.stationId);

    if (
      line &&
      (await this.dispatching.enqueue({ task, line, runId: event.runId }))
    ) {
      return;
    }

    await this.tasks.save(task.runNeverStarted(event.runId));
  }
}

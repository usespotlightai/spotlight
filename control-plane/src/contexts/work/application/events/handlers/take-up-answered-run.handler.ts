import type { RunsPort } from '@runs/application/ports/runs.port';
import { RunCheckoutsMapper } from '@work/application/mappers/run-checkouts.mapper';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { TaskAnswered } from '@work/domain/events/task-answered.event';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { checkoutsOf } from '@work/domain/services/task-checkouts';

export class TakeUpAnsweredRun {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly dispatches: DispatchRepository,
    private readonly lines: LineMapsPort,
    private readonly runs: RunsPort,
  ) {}

  async on(event: TaskAnswered): Promise<void> {
    const runId = event.currentRunId;
    const task = await this.tasks.find(event.taskId);

    if (!task?.takesUp(runId)) {
      return;
    }

    const subject = (await this.dispatches.find(runId))?.subject;
    const line = await this.lines.findByStation(
      subject?.kind === 'task' ? subject.stationId : task.stationId,
    );
    const turn = event.awaitedTurn?.runId.equals(runId)
      ? event.awaitedTurn.attempt
      : null;

    await this.runs.resume(
      runId,
      turn,
      'answered',
      RunCheckoutsMapper.toRun(line ? checkoutsOf(task, line) : []),
    );
  }
}

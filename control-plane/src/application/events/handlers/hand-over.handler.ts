import type { ClockPort } from '@application/ports/clock.port';
import type { HandoverPort } from '@application/ports/handover.port';
import type { TaskDispatchPort } from '@application/ports/task-dispatch.port';
import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import type { RunAbandoned } from '@domain/events/run-abandoned.event';
import type { RunCompleted } from '@domain/events/run-completed.event';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { HandoverFor } from '@domain/services/handover-for';
import type { Handover } from '@domain/value-objects/handover.vo';
import type { RunId } from '@domain/value-objects/run-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';

interface Standing {
  readonly task: Task;
  readonly line: AssemblyLine | null;
}

export class HandOver implements HandoverPort {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: AssemblyLineRepository,
    private readonly dispatch: TaskDispatchPort,
    private readonly clock: ClockPort,
  ) {}

  async onRunCompleted(event: RunCompleted): Promise<void> {
    const standing = await this.waiting(event.runId, event.taskId);
    if (!standing) {
      return;
    }

    const { task, line } = standing;

    const handover =
      event.declared && !event.result.failed
        ? HandoverFor.declared(
            event.declared,
            line?.stations ?? [],
            task.stationId,
          )
        : HandoverFor.outcome(event.result);

    const worked = event.session
      ? task.workedIn(event.session, event.workedBy)
      : task;

    await this.tasks.save(
      await this.applied(handover, worked, line, event.runId),
    );
  }

  async onRunAbandoned(event: RunAbandoned): Promise<void> {
    const standing = await this.waiting(event.runId, event.taskId);
    if (!standing) {
      return;
    }

    await this.tasks.save(
      await this.applied(
        HandoverFor.exhausted(event.attempt),
        standing.task,
        standing.line,
        event.runId,
      ),
    );
  }

  /** Nothing to do for a task another run has since taken up. */
  private async waiting(
    runId: RunId,
    taskId: TaskId | null,
  ): Promise<Standing | null> {
    if (!taskId) {
      return null;
    }

    const task = await this.tasks.find(taskId);
    if (!task?.currentRunId?.equals(runId)) {
      return null;
    }

    return { task, line: await this.lines.holding(task.stationId) };
  }

  private async applied(
    handover: Handover,
    task: Task,
    line: AssemblyLine | null,
    run: RunId,
  ): Promise<Task> {
    const standing = line?.stationAt(task.stationId);

    const saying = {
      station: standing?.name ?? StationName.of('Unknown'),
      body: handover.body,
      at: this.clock.now(),
      run,
    };

    if (handover.kind === 'review' || !handover.stationId || !line) {
      return task.askedAbout(saying);
    }

    const arriving = handover.stationId;
    const behind = await this.tasks.placementsAt(arriving);
    const last = behind[behind.length - 1] ?? null;

    const passed = task.passedTo(
      arriving,
      TaskRank.between(last ? last.rank : null, null),
      saying,
    );

    const station = line.stationAt(arriving);
    const runId = station
      ? await this.dispatch.dispatch({ task: passed, line })
      : null;

    return runId ? passed.handedTo(runId) : passed;
  }
}

import type { ClockPort } from '@application/ports/clock.port';
import type { RunOutcomes } from '@application/services/run-outcomes';
import type { TaskDispatching } from '@application/services/task-dispatch';
import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import type { RunAbandoned } from '@domain/events/run-abandoned.event';
import type { RunCompleted } from '@domain/events/run-completed.event';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { HandoverFor } from '@domain/services/handover-for';
import { Placement } from '@domain/services/placement';
import type { Handover } from '@domain/value-objects/handover.vo';
import type { RunId } from '@domain/value-objects/run-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import { Voice } from '@domain/value-objects/voice.vo';

interface Standing {
  readonly task: Task;
  readonly line: AssemblyLine | null;
}

export class HandOver implements RunOutcomes {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: AssemblyLineRepository,
    private readonly dispatch: TaskDispatching,
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
      station: standing?.name ?? StationName.unknown(),
      body: handover.body,
      at: this.clock.now(),
      voice: Voice.station(run),
    };

    if (handover.kind === 'done') {
      return task.finishedHere(saying);
    }

    if (handover.kind === 'review' || !handover.stationId || !line) {
      return task.askedAbout(saying);
    }

    const arriving = line.stationAt(handover.stationId);

    if (!arriving) {
      return task.askedAbout(saying);
    }

    const passed = task.moveTo(
      arriving,
      Placement.atTheBack(await this.tasks.placementsAt(arriving.id)),
      saying,
    );

    const runId = await this.dispatch.dispatch({ task: passed, line });

    return runId ? passed.handedTo(runId) : passed;
  }
}

import type { ClockPort } from '@application/ports/clock.port';
import type { AnnounceTaskEvents } from '@application/services/announce-task-events';
import type { RunOutcomes } from '@application/services/run-outcomes';
import type { TaskDispatching } from '@application/services/task-dispatch';
import type { Line } from '@domain/aggregates/line.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import type { RunAbandoned } from '@domain/events/run-abandoned.event';
import type { RunCompleted } from '@domain/events/run-completed.event';
import type { LineRepository } from '@domain/repositories/line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { HandoverFor } from '@domain/services/handover-for';
import { Placement } from '@domain/services/placement';
import { routeAfterRun } from '@domain/services/route-after-run';
import type { Handover } from '@domain/value-objects/handover.vo';
import type { RunId } from '@domain/value-objects/run-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import { Voice } from '@domain/value-objects/voice.vo';

interface Standing {
  readonly task: Task;
  readonly line: Line | null;
}

export class HandOver implements RunOutcomes {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
    private readonly dispatch: TaskDispatching,
    private readonly clock: ClockPort,
    private readonly announce: AnnounceTaskEvents,
  ) {}

  async onRunCompleted(event: RunCompleted): Promise<void> {
    const standing = await this.waiting(event.runId, event.taskId);
    if (!standing) {
      return;
    }

    const { task, line } = standing;

    const handover = event.result.stopped
      ? HandoverFor.stopped()
      : event.declared && !event.result.failed
        ? HandoverFor.declared(event.declared, line, task.stationId)
        : HandoverFor.outcome(event.result);

    const worked = event.session
      ? task.workedIn(event.session, event.workedBy)
      : task;

    await this.saved(await this.applied(handover, worked, line, event.runId));
  }

  async onRunAbandoned(event: RunAbandoned): Promise<void> {
    const standing = await this.waiting(event.runId, event.taskId);
    if (!standing) {
      return;
    }

    await this.saved(
      await this.applied(
        HandoverFor.exhausted(event.attempt),
        standing.task,
        standing.line,
        event.runId,
      ),
    );
  }

  // Called directly, not dispatched: the run-event dispatcher is already running this handler.
  private async saved(task: Task): Promise<void> {
    await this.tasks.save(task);
    await this.announce.of(task);
  }

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
    line: Line | null,
    run: RunId,
  ): Promise<Task> {
    const standing = line?.stationAt(task.stationId);

    const saying = {
      station: standing?.name ?? StationName.unknown(),
      body: handover.body,
      at: this.clock.now(),
      voice: Voice.station(run),
    };

    const routing = routeAfterRun(handover, line);

    if (routing.kind === 'finish') {
      return task.finishedHere(saying);
    }

    if (routing.kind === 'ask') {
      return task.askedAbout(saying);
    }

    const passed = task.moveTo(
      routing.to,
      Placement.atTheBack(await this.tasks.placementsAt(routing.to.id)),
      saying,
    );

    const runId = await this.dispatch.dispatch({
      task: passed,
      line: routing.line,
    });

    return runId ? passed.handedTo(runId) : passed;
  }
}

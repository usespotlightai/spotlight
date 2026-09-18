import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import type { RunOutcomes } from '@work/application/services/run-outcomes';
import type { TaskDispatching } from '@work/application/services/task-dispatch';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { RunAbandoned } from '@work/domain/events/run-abandoned.event';
import type { RunCompleted } from '@work/domain/events/run-completed.event';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { HandoverFor } from '@work/domain/services/handover-for';
import { Placement } from '@work/domain/services/placement';
import { routeAfterRun } from '@work/domain/services/route-after-run';
import type { Handover } from '@work/domain/value-objects/handover.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

interface Standing {
  readonly task: Task;
  readonly line: Line | null;
}

export class HandOver implements RunOutcomes {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly placements: TaskPlacementsPort,
    private readonly lines: LineRepository,
    private readonly dispatch: TaskDispatching,
    private readonly clock: ClockPort,
  ) {}

  async onRunCompleted(event: RunCompleted): Promise<void> {
    const standing = await this.waiting(event.runId, event.taskId);
    if (!standing) {
      return;
    }

    const { task, line } = standing;

    const handover = HandoverFor.after({
      outcome: event.outcome,
      declared: event.declared,
      line,
      standingAt: task.stationId,
    });

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
  }

  private async waiting(
    runId: RunId,
    taskId: TaskId | null,
  ): Promise<Standing | null> {
    if (!taskId) {
      return null;
    }

    const task = await this.tasks.find(taskId);
    if (!task?.heldBy(runId)) {
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
      return task.finishedHere(run, routing.line, saying);
    }

    if (routing.kind === 'ask') {
      return task.askedAbout(saying, run);
    }

    const passed = task.passedOn(
      run,
      routing.line,
      routing.to.id,
      Placement.atTheBack(
        (await this.placements.placementsAt(routing.to.id)).map(
          (each) => each.rank,
        ),
      ),
      saying,
    );

    const runId = passed.wantsRun(routing.line)
      ? await this.dispatch.runIdFor({ task: passed, line: routing.line })
      : null;

    return runId ? passed.handedTo(runId, routing.line) : passed;
  }
}

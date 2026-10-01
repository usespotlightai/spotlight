import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import type { RunOutcomes } from '@work/application/services/run-outcomes';
import type { TaskDispatching } from '@work/application/services/task-dispatch';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Saying, Task } from '@work/domain/aggregates/task.aggregate';
import type { RunAbandoned } from '@work/domain/events/run-abandoned.event';
import type { RunCompleted } from '@work/domain/events/run-completed.event';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
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
    private readonly runs: RunRepository,
    private readonly placements: TaskPlacementsPort,
    private readonly lines: LineRepository,
    private readonly dispatch: TaskDispatching,
    private readonly clock: ClockPort,
  ) {}

  async onRunCompleted(event: RunCompleted): Promise<void> {
    const standing = await this.waiting(event);
    if (!standing) {
      await this.superseded(event.runId, event.taskId);
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
    const standing = await this.waiting(event);
    if (!standing) {
      await this.superseded(event.runId, event.taskId);
      return;
    }

    await this.saved(
      await this.applied(
        HandoverFor.exhausted(event.lapses),
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

  private async superseded(runId: RunId, taskId: TaskId | null): Promise<void> {
    if (!taskId) {
      return;
    }

    const run = await this.runs.findById(runId);
    const superseded = run?.supersededByItsTask();

    if (superseded && superseded !== run) {
      await this.runs.save(superseded);
    }
  }

  private async waiting(
    ended: RunCompleted | RunAbandoned,
  ): Promise<Standing | null> {
    const revision = ended.subject?.revision ?? null;

    if (!ended.taskId || revision === null) {
      return null;
    }

    const task = await this.tasks.find(ended.taskId);
    if (!task?.heldBy(ended.runId)) {
      return null;
    }

    if (!task.standsAt(revision)) {
      throw new InconsistentStateError(
        'task',
        'is held by a run handed a revision it has since moved on from',
      );
    }

    return { task, line: await this.lines.holding(task.stationId) };
  }

  private sayingOf(
    handover: Handover,
    task: Task,
    line: Line | null,
    run: RunId,
  ): Saying {
    return {
      station: line?.stationAt(task.stationId)?.name ?? StationName.unknown(),
      body: handover.body,
      at: this.clock.now(),
      voice: Voice.station(run),
    };
  }

  private async applied(
    handover: Handover,
    task: Task,
    line: Line | null,
    run: RunId,
  ): Promise<Task> {
    const saying = this.sayingOf(handover, task, line, run);
    const routing = routeAfterRun(handover, line, task);

    if (routing.kind === 'finish') {
      return task.finishedHere(run, routing.line, saying);
    }

    if (routing.kind === 'let-go') {
      return (
        routing.failure ? task.failed(routing.failure, saying, run, line) : task
      ).leftBy(run, saying.at);
    }

    if (routing.kind === 'ask') {
      return routing.failure
        ? task.failed(routing.failure, saying, run, line)
        : task.askedAbout(saying, run);
    }

    const ranks = (await this.placements.placementsAt(routing.to.id)).map(
      (each) => each.rank,
    );
    const moved =
      routing.kind === 'advance'
        ? task.passedOn(
            run,
            routing.line,
            routing.to.id,
            Placement.atTheBack(ranks),
            saying,
          )
        : task.movedAsHeldBack(
            run,
            routing.line,
            routing.to.id,
            Placement.atTheTop(ranks),
            { saying, handover },
          );

    const runId = moved.wantsRun(routing.line)
      ? await this.dispatch.runIdFor({ task: moved, line: routing.line })
      : null;

    return runId ? moved.handedTo(runId, routing.line) : moved;
  }
}

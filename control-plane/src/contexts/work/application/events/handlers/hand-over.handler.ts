import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import type { RunOutcomes } from '@work/application/services/run-outcomes';
import type { TaskDispatching } from '@work/application/services/task-dispatch';
import type { NewNote, Task } from '@work/domain/aggregates/task.aggregate';
import type { RunCompleted } from '@work/domain/events/run-completed.event';
import type { RunExhausted } from '@work/domain/events/run-exhausted.event';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { HandoverFor } from '@work/domain/services/handover-for';
import { Placement } from '@work/domain/services/placement';
import { routeAfterRun } from '@work/domain/services/route-after-run';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { ResolvedHandover } from '@work/domain/value-objects/resolved-handover.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

interface WaitingTask {
  readonly task: Task;
  readonly line: LineMap | null;
}

export class HandOver implements RunOutcomes {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly placements: TaskPlacementsPort,
    private readonly lines: LineMapsPort,
    private readonly dispatch: TaskDispatching,
    private readonly clock: ClockPort,
  ) {}

  async onRunCompleted(event: RunCompleted): Promise<void> {
    const found = await this.waiting(event);
    if (!found) {
      return;
    }

    const { task, line } = found;

    const handover = HandoverFor.after({
      outcome: event.outcome,
      handover: event.handover,
      line,
      currentStation: task.stationId,
      lastWords: event.lastWords,
    });

    const recorded = event.session
      ? task.recordSession(event.runId, event.session, event.claimedBy)
      : task;

    await this.saved(await this.applied(handover, recorded, line, event.runId));
  }

  async onRunExhausted(event: RunExhausted): Promise<void> {
    const found = await this.waiting(event);
    if (!found) {
      return;
    }

    await this.saved(
      await this.applied(
        HandoverFor.exhausted(
          event.expiredLeases,
          event.failure ?? 'runner-lost',
        ),
        found.task,
        found.line,
        event.runId,
      ),
    );
  }

  // This is called directly, not dispatched, because the run-event dispatcher already runs this handler.
  private async saved(task: Task): Promise<void> {
    await this.tasks.save(task);
  }

  private async waiting(
    ended: RunCompleted | RunExhausted,
  ): Promise<WaitingTask | null> {
    const revision = ended.subject?.revision ?? null;

    if (!ended.taskId || revision === null) {
      return null;
    }

    const task = await this.tasks.find(ended.taskId);
    if (!task?.hasCurrentRun(ended.runId)) {
      return null;
    }

    if (!task.isAtRevision(revision)) {
      throw new InconsistentStateError(
        'task',
        'has a current run with a revision that the task has since moved on from',
      );
    }

    return { task, line: await this.lines.findByStation(task.stationId) };
  }

  private newNoteOf(
    handover: ResolvedHandover,
    task: Task,
    line: LineMap | null,
    run: RunId,
  ): NewNote {
    return {
      station: line?.stationAt(task.stationId) ?? null,
      body: handover.body,
      at: this.clock.now(),
      voice: Voice.station(run),
      attachments: handover.attachments,
    };
  }

  private async applied(
    handover: ResolvedHandover,
    task: Task,
    line: LineMap | null,
    run: RunId,
  ): Promise<Task> {
    const newNote = this.newNoteOf(handover, task, line, run);
    const routing = routeAfterRun(handover, line, task);

    if (routing.kind === 'finish') {
      return task.finishHere(run, routing.line, newNote);
    }

    if (routing.kind === 'detach') {
      return (
        routing.failure
          ? task.failed(routing.failure, newNote, run, line)
          : task
      ).leaveRun(run, newNote.at);
    }

    if (routing.kind === 'ask') {
      return routing.failure
        ? task.failed(routing.failure, newNote, run, line)
        : task.askedAbout(newNote, run);
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
            Placement.entering('passed-on', ranks),
            newNote,
          )
        : task.moveAsDeferred(
            run,
            routing.line,
            routing.to.id,
            Placement.entering('deferred', ranks),
            { newNote, handover },
          );

    const runId = moved.wantsRun(routing.line)
      ? await this.dispatch.runIdFor({ task: moved, line: routing.line })
      : null;

    return runId ? moved.assignRun(runId, routing.line) : moved;
  }
}

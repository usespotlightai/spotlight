import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import type { TaskDispatching } from '@work/application/services/task-dispatch';
import type { NewNote, Task } from '@work/domain/aggregates/task.aggregate';
import { Placement } from '@work/domain/services/placement';
import { routeAfterRun } from '@work/domain/services/route-after-run';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { ResolvedHandover } from '@work/domain/value-objects/resolved-handover.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

export class RunRouting {
  constructor(
    private readonly placements: TaskPlacementsPort,
    private readonly dispatch: TaskDispatching,
    private readonly clock: ClockPort,
  ) {}

  newNoteOf(
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

  async routed(
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

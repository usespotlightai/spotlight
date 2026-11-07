import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import { lastWordsIn } from '@work/application/services/last-words';
import type { RunOutcomes } from '@work/application/services/run-outcomes';
import type { RunRouting } from '@work/application/services/run-routing.service';
import { WorkRequesters } from '@work/application/services/work-requesters';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { RunCompleted } from '@work/domain/events/run-completed.event';
import type { RunExhausted } from '@work/domain/events/run-exhausted.event';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { HandoverFor } from '@work/domain/services/handover-for';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';

interface WaitingTask {
  readonly task: Task;
  readonly line: LineMap | null;
}

export class HandOver implements RunOutcomes {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineMapsPort,
    private readonly routing: RunRouting,
    private readonly journals: RunJournalReaderPort,
  ) {}

  async onRunCompleted(event: RunCompleted): Promise<void> {
    if (event.outcome.handsOver) {
      return;
    }

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
      lastWords:
        event.reported && !event.handover
          ? lastWordsIn(
              await this.journals.attemptsOfRun(event.runId),
              task.lastPersonNoteAt,
            )
          : null,
    });

    const recorded = event.session
      ? task.recordSession(event.runId, event.session, event.claimedBy)
      : task;

    await this.saved(
      await this.routing.routed(handover, recorded, line, event.runId),
    );
  }

  async onRunExhausted(event: RunExhausted): Promise<void> {
    const found = await this.waiting(event);
    if (!found) {
      return;
    }

    await this.saved(
      await this.routing.routed(
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
    const requested = WorkRequesters.decode(ended.requester.parts);

    if (!requested || !('task' in requested)) {
      return null;
    }

    const { task: taskId, revision } = requested;
    const task = await this.tasks.find(taskId);
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
}

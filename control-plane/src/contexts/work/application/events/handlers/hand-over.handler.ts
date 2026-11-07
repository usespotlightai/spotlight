import type { RunJournalReadingsPort } from '@runs/application/ports/run-journal-readings.port';
import type { RunEndedIntegrationEvent } from '@shared-kernel/application/integration-events/run-ended.integration-event';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import {
  RunEndedFacts,
  type RunEndingReactions,
} from '@work/application/services/run-ending-reactions';
import type { RunRouting } from '@work/application/services/run-routing.service';
import { WorkRequesters } from '@work/application/services/work-requesters';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { HandoverFor } from '@work/domain/services/handover-for';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';

interface WaitingTask {
  readonly task: Task;
  readonly line: LineMap | null;
}

export class HandOver implements RunEndingReactions {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineMapsPort,
    private readonly routing: RunRouting,
    private readonly journals: RunJournalReaderPort,
    private readonly readings: RunJournalReadingsPort,
  ) {}

  async onRunEnded(event: RunEndedIntegrationEvent): Promise<void> {
    if (event.endedBy === 'turn') {
      await this.completed(event);
    }

    if (event.endedBy === 'exhaustion') {
      await this.exhausted(event);
    }
  }

  private async completed(event: RunEndedIntegrationEvent): Promise<void> {
    if (event.handsOver) {
      return;
    }

    const found = await this.waiting(event);
    if (!found) {
      return;
    }

    const { task, line } = found;
    const runId = RunEndedFacts.runId(event);
    const handed = RunEndedFacts.handover(event);
    const session = RunEndedFacts.session(event);

    const handover = HandoverFor.after({
      outcome: RunEndedFacts.result(event),
      handover: handed,
      line,
      currentStation: task.stationId,
      lastWords:
        event.reported && !handed
          ? this.readings.lastWordsIn(
              await this.journals.attemptsOfRun(runId),
              task.lastPersonNoteAt,
            )
          : null,
    });

    const recorded = session
      ? task.recordSession(runId, session, RunEndedFacts.claimedBy(event))
      : task;

    await this.saved(
      await this.routing.routed(handover, recorded, line, runId),
    );
  }

  private async exhausted(event: RunEndedIntegrationEvent): Promise<void> {
    const found = await this.waiting(event);
    if (!found) {
      return;
    }

    await this.saved(
      await this.routing.routed(
        HandoverFor.exhausted(
          event.expiredLeases,
          RunEndedFacts.failure(event) ?? 'runner-lost',
        ),
        found.task,
        found.line,
        RunEndedFacts.runId(event),
      ),
    );
  }

  // This is called directly, not dispatched, because the run-event dispatcher already runs this handler.
  private async saved(task: Task): Promise<void> {
    await this.tasks.save(task);
  }

  private async waiting(
    ended: RunEndedIntegrationEvent,
  ): Promise<WaitingTask | null> {
    const requested = WorkRequesters.decode(ended.requester);

    if (!requested || !('task' in requested)) {
      return null;
    }

    const { task: taskId, revision } = requested;
    const task = await this.tasks.find(taskId);
    if (!task?.hasCurrentRun(RunEndedFacts.runId(ended))) {
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

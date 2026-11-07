import type {
  RunTurnsPort,
  TurnFacts,
} from '@runs/application/ports/run-turns.port';
import type { RunsPort } from '@runs/application/ports/runs.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { isRunFailureCode } from '@shared-kernel/domain/value-objects/run-failure-code';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { LifecycleHooksPort } from '@work/application/ports/lifecycle-hooks.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import type { TaskViewsPort } from '@work/application/ports/task-views.port';
import type { FilesLoader } from '@work/application/services/files-loader.service';
import { lastWordsIn } from '@work/application/services/last-words';
import type { RunRouting } from '@work/application/services/run-routing.service';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { TurnDecision } from '@work/domain/services/turn-decision';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { AwaitedTurn } from '@work/domain/value-objects/awaited-turn.vo';
import { Handover } from '@work/domain/value-objects/handover.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { RunResult } from '@work/domain/value-objects/run-result.vo';

const resultOf = (outcome: TurnFacts['outcome']): RunResult =>
  RunResult.of({
    exitCode: outcome.exitCode,
    failure:
      outcome.failure !== null && isRunFailureCode(outcome.failure)
        ? outcome.failure
        : null,
    message: outcome.message,
    stopped: outcome.stopped,
  });

const handoverOf = (handover: NonNullable<TurnFacts['handover']>): Handover =>
  Handover.of({
    next: handover.next,
    note: handover.note,
    attachments: handover.files.map((each) => Attachment.rehydrate(each)),
  });

const sessionOf = (turn: TurnFacts): HarnessSession | null =>
  turn.session ? HarnessSession.of(turn.session) : null;

export class TakeTurn {
  constructor(
    private readonly turns: RunTurnsPort,
    private readonly runs: RunsPort,
    private readonly dispatches: DispatchRepository,
    private readonly tasks: TaskRepository,
    private readonly lines: LineMapsPort,
    private readonly journals: RunJournalReaderPort,
    private readonly taskViews: TaskViewsPort,
    private readonly hooks: LifecycleHooksPort,
    private readonly files: FilesLoader,
    private readonly routing: RunRouting,
  ) {}

  async take(runId: RunId, attempt: number): Promise<void> {
    const turn = await this.turns.turnOf(runId, attempt);

    if (!turn) {
      return;
    }

    const dispatch = await this.dispatches.find(runId);
    const subject = dispatch?.subject;
    const task =
      subject?.kind === 'task' ? await this.tasks.find(subject.taskId) : null;

    if (subject?.kind !== 'task' || !task?.hasCurrentRun(runId)) {
      await this.runs.finish(runId, attempt);
      return;
    }

    const awaited = AwaitedTurn.of(runId, attempt);

    if (task.awaitedTurn?.equals(awaited)) {
      await this.runs.keep(runId, attempt);
      return;
    }

    if (!task.isAtRevision(subject.revision)) {
      throw new InconsistentStateError(
        'task',
        'holds a run with a revision that the task has since moved on from',
      );
    }

    const line = await this.lines.findByStation(task.stationId);
    const handover = turn.handover
      ? await this.submitted(task, runId, handoverOf(turn.handover))
      : null;
    const decision = TurnDecision.after({
      task,
      line,
      outcome: resultOf(turn.outcome),
      handover,
      lastWords: handover
        ? null
        : lastWordsIn(
            await this.journals.attemptsOfRun(runId),
            task.lastPersonNoteAt,
          ),
      stopRequested: turn.stopRequested,
    });

    if (decision.kind === 'resume') {
      await this.runs.resume(runId, attempt, 'messages', decision.checkouts);
      return;
    }

    await this.files.takenIn(task.workspaceId, handover?.attachments ?? []);

    if (decision.kind === 'keep') {
      await this.tasks.save(
        task.awaitTurn({
          turn: awaited,
          note: this.routing.newNoteOf(decision.handover, line, runId),
          session: sessionOf(turn),
          runner: turn.reportedBy,
        }),
      );
      await this.runs.keep(runId, attempt);
      return;
    }

    await this.tasks.save(await this.routed(task, line, turn, decision));
    await this.runs.finish(runId, attempt);
  }

  private routed(
    task: Task,
    line: LineMap | null,
    turn: TurnFacts,
    decision: Extract<TurnDecision, { kind: 'route' }>,
  ): Promise<Task> {
    const session = sessionOf(turn);
    const recorded = session
      ? task.recordSession(turn.runId, session, turn.reportedBy)
      : task;

    return this.routing.routed(decision.handover, recorded, line, turn.runId);
  }

  private async submitted(
    task: Task,
    runId: RunId,
    handover: Handover,
  ): Promise<Handover> {
    const view = await this.taskViews.of(task.id.value, runId.value);

    if (!view) {
      return handover;
    }

    const decision = await this.hooks.before(view, {
      on: 'handover.submitting',
      to: handover.next === '' ? null : handover.next,
      note: handover.note,
    });

    return decision.kind === 'denied'
      ? handover.sentToReview(decision.reason)
      : handover;
  }
}

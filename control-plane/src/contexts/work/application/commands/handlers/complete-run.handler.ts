import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { CompleteRunCommand } from '@work/application/commands/runner.commands';
import type { LifecycleHooksPort } from '@work/application/ports/lifecycle-hooks.port';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import type { TaskViewsPort } from '@work/application/ports/task-views.port';
import { lastWordsIn } from '@work/application/services/last-words';
import { RunVersionConflictError } from '@work/domain/exceptions/run-version-conflict.error';
import { TaskVersionConflictError } from '@work/domain/exceptions/task-version-conflict.error';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { turnEnded } from '@work/domain/services/turn-end';
import { Handover } from '@work/domain/value-objects/handover.vo';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';

const ATTEMPTS = 3;

const isVersionConflict = (error: unknown): boolean =>
  error instanceof RunVersionConflictError ||
  error instanceof TaskVersionConflictError;

export class CompleteRunHandler
  implements CommandHandlerPort<CompleteRunCommand, void>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly tasks: TaskRepository,
    private readonly lines: LineRepository,
    private readonly transaction: TransactionPort,
    private readonly taskViews: TaskViewsPort,
    private readonly hooks: LifecycleHooksPort,
    private readonly clock: ClockPort,
    private readonly journals: RunJournalReaderPort,
  ) {}

  async execute(command: CompleteRunCommand): Promise<void> {
    try {
      const runId = RunId.of(command.runId);
      const runnerId = RunnerId.of(command.runnerId);

      if (command.timedOut) {
        return await this.retrying(() => this.timedOut(runId, runnerId));
      }

      const outcome = command.stopped
        ? RunOutcome.stopped(command.exitCode)
        : RunOutcome.of({
            exitCode: command.exitCode,
            failed: command.failed,
            setupFailed: command.setupFailed,
            message: command.message,
          });
      const handover =
        command.handover && outcome.handsOver
          ? await this.handingOver(
              runId,
              runnerId,
              Handover.of(command.handover),
            )
          : command.handover
            ? Handover.of(command.handover)
            : null;

      const report = HandoverReport.of({
        handover,
        session: command.sessionId
          ? HarnessSession.of(command.sessionId)
          : null,
        lastWords: handover ? null : await this.lastWordsOf(runId),
      });

      return await this.retrying(() =>
        this.ended(runId, runnerId, outcome, report),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async lastWordsOf(runId: RunId): Promise<string | null> {
    const run = await this.runs.findById(runId);
    const task = run?.taskId ? await this.tasks.find(run.taskId) : null;
    const answered = [...(task?.notes ?? [])]
      .reverse()
      .find((note) => note.voice.isPerson);

    return lastWordsIn(
      await this.journals.attemptsOfRun(runId),
      answered?.at ?? null,
    );
  }

  private async retrying(work: () => Promise<void>): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.transaction.inTransaction(work);
      } catch (error) {
        if (!isVersionConflict(error) || attempt >= ATTEMPTS) {
          throw error;
        }
      }
    }
  }

  private async timedOut(runId: RunId, by: RunnerId): Promise<void> {
    const run = await this.runs.findById(runId);

    if (!run) {
      throw new UnknownRunError(`Run ${runId.value} not found.`);
    }

    await this.runs.save(run.timedOut(by, this.clock.now()));
  }

  private async ended(
    runId: RunId,
    by: RunnerId,
    outcome: RunOutcome,
    report: HandoverReport,
  ): Promise<void> {
    const run = await this.runs.findById(runId);

    if (!run) {
      throw new UnknownRunError(`Run ${runId.value} not found.`);
    }

    const task = run.taskId ? await this.tasks.find(run.taskId) : null;
    const line = task ? await this.lines.findByStation(task.stationId) : null;
    const ended = turnEnded({
      run,
      by,
      task,
      line,
      outcome,
      report,
      now: this.clock.now(),
    });

    if (ended.task) {
      await this.tasks.save(ended.task);
    }

    if (ended.run !== run) {
      await this.runs.save(ended.run);
    }
  }

  private async handingOver(
    runId: RunId,
    runnerId: RunnerId,
    handover: Handover,
  ): Promise<Handover> {
    const run = await this.runs.findById(runId);

    if (
      !run?.firesHooks ||
      !run.taskId ||
      run.hasEnded ||
      !run.wasClaimedBy(runnerId)
    ) {
      return handover;
    }

    const taskView = await this.taskViews.of(run.taskId.value, run.id.value);

    if (!taskView) {
      return handover;
    }

    const decision = await this.hooks.before(taskView, {
      on: 'handover.submitting',
      to: handover.next === '' ? null : handover.next,
      note: handover.note,
    });

    return decision.kind === 'denied'
      ? handover.sentToReview(decision.reason)
      : handover;
  }
}

import type { CompleteRunCommand } from '@runs/application/commands/runner.commands';
import type { RunFilesPort } from '@runs/application/ports/run-files.port';
import type { Run } from '@runs/domain/aggregates/run.aggregate';
import { RunVersionConflictError } from '@runs/domain/exceptions/run-version-conflict.error';
import { UnknownRunError } from '@runs/domain/exceptions/unknown-run.error';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { HandedOverFile } from '@runs/domain/value-objects/handed-over-file.vo';
import { Handover } from '@runs/domain/value-objects/handover.vo';
import { HandoverReport } from '@runs/domain/value-objects/handover-report.vo';
import { HarnessSession } from '@runs/domain/value-objects/harness-session.vo';
import { RunOutcome } from '@runs/domain/value-objects/run-outcome.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

const ATTEMPTS = 3;

export class CompleteRunHandler
  implements CommandHandlerPort<CompleteRunCommand, void>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
    private readonly files: RunFilesPort,
  ) {}

  async execute(command: CompleteRunCommand): Promise<void> {
    try {
      const runId = RunId.of(command.runId);
      const runnerId = RunnerId.of(command.runnerId);

      if (command.timedOut) {
        return await this.changed(runId, (run) =>
          run.timedOut(runnerId, this.clock.now()),
        );
      }

      const outcome = command.stopped
        ? RunOutcome.stopped(command.exitCode)
        : RunOutcome.of({
            exitCode: command.exitCode,
            failed: command.failed,
            setupFailed: command.setupFailed,
            message: command.message,
          });
      const attachments = outcome.handsOver
        ? await this.handedOverBy(
            await this.found(runId),
            command.handover?.attachments ?? [],
          )
        : [];
      const report = HandoverReport.of({
        handover: command.handover
          ? Handover.of({ ...command.handover, attachments })
          : null,
        session: command.sessionId
          ? HarnessSession.of(command.sessionId)
          : null,
      });

      return await this.changed(runId, (run) =>
        run.reportTurn(runnerId, outcome, report, this.clock.now()),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async handedOverBy(
    run: Run,
    ids: readonly string[],
  ): Promise<HandedOverFile[]> {
    if (ids.length === 0 || !run.policy.actsBeyondItself) {
      return [];
    }

    const files = await this.files.uploadedBy(run.id, run.workspaceId, ids);

    if (!run.policy.holdsTurn) {
      await this.files.take(run.workspaceId, files);
    }

    return files.map((each) => HandedOverFile.of(each));
  }

  private async found(runId: RunId): Promise<Run> {
    const run = await this.runs.findById(runId);

    if (!run) {
      throw new UnknownRunError(`Run ${runId.value} not found.`);
    }

    return run;
  }

  private async changed(
    runId: RunId,
    change: (run: Run) => Run,
  ): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.transaction.inTransaction(async () => {
          await this.runs.save(change(await this.found(runId)));
        });
      } catch (error) {
        if (
          !(error instanceof RunVersionConflictError) ||
          attempt >= ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }
}

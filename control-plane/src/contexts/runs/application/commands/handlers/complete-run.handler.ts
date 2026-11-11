import type { CompleteRunCommand } from '@runs/application/commands/runner.commands';
import type { RunFileFacts } from '@runs/application/ports/run-files.port';
import type { RunFileSources } from '@runs/application/services/run-file-sources.service';
import type { Run } from '@runs/domain/aggregates/run.aggregate';
import { RunVersionConflictError } from '@runs/domain/exceptions/run-version-conflict.error';
import { UnknownRunError } from '@runs/domain/exceptions/unknown-run.error';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { ExitCode } from '@runs/domain/value-objects/exit-code.vo';
import { HandedOverFile } from '@runs/domain/value-objects/handed-over-file.vo';
import { HandoverReport } from '@runs/domain/value-objects/handover-report.vo';
import { Handover } from '@runs/domain/value-objects/handover.vo';
import { HarnessSession } from '@runs/domain/value-objects/harness-session.vo';
import { RunOutcome } from '@runs/domain/value-objects/run-outcome.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

const ATTEMPTS = 3;

export class CompleteRunHandler implements CommandHandlerPort<
  CompleteRunCommand,
  void
> {
  constructor(
    private readonly runs: RunRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
    private readonly files: RunFileSources,
  ) {}

  async execute(command: CompleteRunCommand): Promise<void> {
    try {
      const runId = RunId.of(command.runId);
      const runnerId = RunnerId.of(command.runnerId);

      if (command.timedOut) {
        await this.changed(runId, (run) =>
          run.timedOut(runnerId, this.clock.now()),
        );
        return;
      }

      const outcome = command.stopped
        ? RunOutcome.stopped(ExitCode.of(command.exitCode))
        : RunOutcome.of({
            exitCode: ExitCode.of(command.exitCode),
            failed: command.failed,
            setupFailed: command.setupFailed,
            detail: command.message,
          });
      const run = await this.found(runId);
      const files = outcome.handsOver
        ? await this.handedOverBy(run, command.handover?.attachments ?? [])
        : [];
      const report = HandoverReport.of({
        handover: command.handover
          ? Handover.of({
              ...command.handover,
              attachments: files.map((each) => HandedOverFile.of(each)),
            })
          : null,
        session: command.sessionId
          ? HarnessSession.of(command.sessionId)
          : null,
      });

      const reported = await this.changed(runId, (current) =>
        current.reportTurn(runnerId, outcome, report, this.clock.now()),
      );

      if (reported.takesFilesAtCompletion && files.length > 0) {
        await this.files.take(reported, files);
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async handedOverBy(
    run: Run,
    ids: readonly string[],
  ): Promise<readonly RunFileFacts[]> {
    if (ids.length === 0 || !run.handsOverFiles) {
      return [];
    }

    return this.files.uploadedBy(run, ids);
  }

  private async found(runId: RunId): Promise<Run> {
    const run = await this.runs.findById(runId);

    if (!run) {
      throw new UnknownRunError(`Run ${runId.value} not found.`);
    }

    return run;
  }

  private async changed(runId: RunId, change: (run: Run) => Run): Promise<Run> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.transaction.inTransaction(async () => {
          const changed = change(await this.found(runId));

          await this.runs.save(changed);

          return changed;
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

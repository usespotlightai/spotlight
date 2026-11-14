import type { AppendSandboxArchiveJournalCommand } from '@runs/application/commands/working-copy-archive.commands';
import type { RunJournalAppends } from '@runs/application/services/run-journal-appends.service';
import type { SandboxArchives } from '@runs/application/services/sandbox-archives.service';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class AppendSandboxArchiveJournalHandler implements CommandHandlerPort<
  AppendSandboxArchiveJournalCommand,
  boolean
> {
  constructor(
    private readonly sandboxes: SandboxArchives,
    private readonly runs: RunRepository,
    private readonly appends: RunJournalAppends,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: AppendSandboxArchiveJournalCommand): Promise<boolean> {
    try {
      const runId = RunId.of(command.runId);
      const sandbox = await this.sandboxes.authenticated(
        command.sandboxId,
        command.token,
      );
      const archived = sandbox
        ? await this.sandboxes.archivedAttemptOf(
            sandbox,
            runId,
            this.clock.now(),
          )
        : null;
      const attempt =
        archived === null
          ? null
          : (await this.runs.findById(runId))?.journalAfterTurnOf(archived);

      if (!attempt) {
        return false;
      }

      await this.appends.append(attempt, command.entries);

      return true;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

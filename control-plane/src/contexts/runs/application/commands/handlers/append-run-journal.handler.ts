import type { AppendRunJournalCommand } from '@runs/application/commands/runner.commands';
import type { RunJournalAppends } from '@runs/application/services/run-journal-appends.service';
import { UnknownRunError } from '@runs/domain/exceptions/unknown-run.error';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class AppendRunJournalHandler implements CommandHandlerPort<
  AppendRunJournalCommand,
  void
> {
  constructor(
    private readonly runs: RunRepository,
    private readonly appends: RunJournalAppends,
  ) {}

  async execute(command: AppendRunJournalCommand): Promise<void> {
    try {
      const journalling = await this.runs.findById(RunId.of(command.runId));
      if (!journalling) {
        throw new UnknownRunError(`Run ${command.runId} not found.`);
      }

      await this.appends.append(
        journalling.journalFor(RunnerId.of(command.runnerId)),
        command.entries,
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

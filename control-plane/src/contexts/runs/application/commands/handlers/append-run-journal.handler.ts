import type { AppendRunJournalCommand } from '@runs/application/commands/runner.commands';
import type { RunJournalPort } from '@runs/application/ports/run-journal.port';
import type { RunStreamPort } from '@runs/application/ports/run-stream.port';
import { UnknownRunError } from '@runs/domain/exceptions/unknown-run.error';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { ReportedJournalEntry } from '@runs/domain/value-objects/reported-journal-entry.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class AppendRunJournalHandler
  implements CommandHandlerPort<AppendRunJournalCommand, void>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly journal: RunJournalPort,
    private readonly stream: RunStreamPort,
  ) {}

  async execute(command: AppendRunJournalCommand): Promise<void> {
    try {
      const journalling = await this.runs.findById(RunId.of(command.runId));
      if (!journalling) {
        throw new UnknownRunError(`Run ${command.runId} not found.`);
      }

      const attempt = journalling.journalFor(RunnerId.of(command.runnerId));
      const reported = command.entries.map((entry) =>
        ReportedJournalEntry.of(entry),
      );

      await this.journal.append(
        attempt,
        reported.map((entry) => ({
          seq: entry.seq.value,
          type: entry.type,
          at: entry.at,
          message: entry.message,
          data: entry.data,
        })),
      );
      this.stream.publish(
        command.runId,
        command.entries.map((entry) => ({
          attempt: attempt.number,
          seq: entry.seq,
          type: entry.type,
          at: entry.at,
          message: entry.message,
          data: entry.data,
        })),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

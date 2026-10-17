import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { AppendRunJournalCommand } from '@work/application/commands/runner.commands';
import type { RunJournalPort } from '@work/application/ports/run-journal.port';
import type { RunStreamPort } from '@work/application/ports/run-stream.port';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';

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

      await this.journal.append(
        attempt,
        command.entries.map((entry) => ({
          seq: entry.seq,
          type: entry.type,
          at: new Date(entry.at),
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

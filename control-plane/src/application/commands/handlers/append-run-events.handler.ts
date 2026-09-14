import type { AppendRunEventsCommand } from '@application/commands/runner.commands';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { RunStreamPort } from '@application/ports/run-stream.port';
import { UnknownRunError } from '@domain/exceptions/unknown-run.error';
import type { RunRepository } from '@domain/repositories/run.repository';
import { RunId } from '@domain/value-objects/run-id.vo';

export class AppendRunEventsHandler
  implements CommandHandlerPort<AppendRunEventsCommand, void>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly stream: RunStreamPort,
  ) {}

  async execute(command: AppendRunEventsCommand): Promise<void> {
    try {
      const id = RunId.of(command.runId);

      const journalling = await this.runs.findById(id);
      if (!journalling) {
        throw new UnknownRunError(`there is no run ${command.runId}`);
      }

      await this.runs.appendEvents(
        id,
        journalling.attempt,
        command.events.map((event) => ({
          seq: event.seq,
          type: event.type,
          at: new Date(event.at),
          message: event.message,
          data: event.data,
        })),
      );
      this.stream.publish(
        command.runId,
        command.events.map((event) => ({
          seq: event.seq,
          type: event.type,
          at: event.at,
          message: event.message,
          data: event.data,
        })),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

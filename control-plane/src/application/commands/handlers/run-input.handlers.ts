import type {
  AwaitRunInputCommand,
  SendRunInputCommand,
  StopRunCommand,
} from '@application/commands/run-input.commands';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { RunEventReaderPort } from '@application/ports/run-event-reader.port';
import type { RunInput, RunInputPort } from '@application/ports/run-input.port';
import { UnknownRunError } from '@domain/exceptions/unknown-run.error';
import type { RunRepository } from '@domain/repositories/run.repository';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

const INPUT_POLL_TIMEOUT_MS = 25_000;

export class SendRunInputHandler
  implements CommandHandlerPort<SendRunInputCommand, void>
{
  constructor(
    private readonly events: RunEventReaderPort,
    private readonly input: RunInputPort,
  ) {}

  async execute(command: SendRunInputCommand): Promise<void> {
    try {
      const watchable = await this.events.findForViewer(
        RunId.of(command.runId),
        UserId.of(command.viewerId),
      );

      if (!watchable) {
        throw new UnknownRunError(`there is no run ${command.runId}`);
      }

      this.input.offer(command.runId, command.input);
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

export class AwaitRunInputHandler
  implements CommandHandlerPort<AwaitRunInputCommand, RunInput[]>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly input: RunInputPort,
  ) {}

  async execute(command: AwaitRunInputCommand): Promise<RunInput[]> {
    try {
      const held = await this.runs.findById(RunId.of(command.runId));
      if (!held) {
        throw new UnknownRunError(`there is no run ${command.runId}`);
      }

      held.assertHeldBy(RunnerId.of(command.runnerId));

      return await this.input.take(command.runId, INPUT_POLL_TIMEOUT_MS);
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

export class StopRunHandler
  implements CommandHandlerPort<StopRunCommand, void>
{
  constructor(
    private readonly events: RunEventReaderPort,
    private readonly input: RunInputPort,
  ) {}

  async execute(command: StopRunCommand): Promise<void> {
    try {
      const watchable = await this.events.findForViewer(
        RunId.of(command.runId),
        UserId.of(command.viewerId),
      );

      if (!watchable) {
        throw new UnknownRunError(`there is no run ${command.runId}`);
      }

      this.input.offer(command.runId, { stop: true });
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

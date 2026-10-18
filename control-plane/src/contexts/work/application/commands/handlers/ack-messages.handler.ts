import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { AckMessagesCommand } from '@work/application/commands/ack-messages.command';
import type { RunWorks } from '@work/application/services/run-works.service';

export class AckMessagesHandler
  implements CommandHandlerPort<AckMessagesCommand, void>
{
  constructor(
    private readonly works: RunWorks,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: AckMessagesCommand): Promise<void> {
    try {
      const { work } = await this.works.leasedBy(
        command.runId,
        command.runnerId,
      );

      await work?.acknowledgeUpTo(command.upTo, this.clock.now());
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

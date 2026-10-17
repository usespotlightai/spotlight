import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { DeliverSaidCommand } from '@work/application/commands/deliver-said.command';
import type { RunWorks } from '@work/application/services/run-works.service';

export class DeliverSaidHandler
  implements CommandHandlerPort<DeliverSaidCommand, void>
{
  constructor(
    private readonly works: RunWorks,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: DeliverSaidCommand): Promise<void> {
    try {
      const { work } = await this.works.leasedBy(
        command.runId,
        command.runnerId,
      );

      await work?.deliverUpTo(command.upTo, this.clock.now());
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

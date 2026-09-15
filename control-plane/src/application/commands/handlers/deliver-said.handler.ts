import type { DeliverSaidCommand } from '@application/commands/deliver-said.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { RunWorks } from '@application/services/run-works.service';

export class DeliverSaidHandler
  implements CommandHandlerPort<DeliverSaidCommand, void>
{
  constructor(
    private readonly works: RunWorks,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: DeliverSaidCommand): Promise<void> {
    try {
      const worked = await this.works.of(command.runId);

      await worked?.work?.deliverUpTo(command.upTo, this.clock.now());
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

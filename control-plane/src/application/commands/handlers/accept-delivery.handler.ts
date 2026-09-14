import type { AcceptDeliveryCommand } from '@application/commands/accept-delivery.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { DeliveryInboxPort } from '@application/ports/delivery-inbox.port';
import type { SourceForDelivery } from '@application/services/source-for-delivery.service';

export class AcceptDeliveryHandler
  implements CommandHandlerPort<AcceptDeliveryCommand, void>
{
  constructor(
    private readonly sources: SourceForDelivery,
    private readonly inbox: DeliveryInboxPort,
  ) {}

  async execute(command: AcceptDeliveryCommand): Promise<void> {
    try {
      const source = await this.sources.find({
        source: command.source,
        workspaceId: command.workspaceId,
        teamId: command.teamId,
        teamKey: command.teamKey,
      });

      if (!source) {
        return;
      }

      await this.inbox.accept({
        source: source.key,
        workspaceId: command.workspaceId,
        teamId: command.teamId,
        teamKey: command.teamKey,
        id: source.delivery(command.delivered),
        headers: command.delivered.headers,
        body: command.delivered.body,
        attempts: 0,
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

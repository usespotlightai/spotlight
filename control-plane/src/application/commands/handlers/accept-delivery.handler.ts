import type { AcceptDeliveryCommand } from '@application/commands/accept-delivery.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { DeliveryInboxPort } from '@application/ports/delivery-inbox.port';
import type { SourceForDelivery } from '@application/services/source-for-delivery.service';

/**
 * All that happens while the host is still waiting. Nothing here reads the
 * delivery beyond asking its source what to call it, so a host is answered
 * in the time it takes to write one row.
 */
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

      // The guard has already had this source vouch for the delivery, so one
      // it does not know cannot reach here.
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

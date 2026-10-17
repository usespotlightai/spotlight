import type { AcceptDeliveryCommand } from '@integrations/application/commands/accept-delivery.command';
import type { DeliveryInboxPort } from '@integrations/application/ports/delivery-inbox.port';
import type { SourceForDelivery } from '@integrations/application/services/source-for-delivery.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

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
      rethrowAsApplicationError(error);
    }
  }
}

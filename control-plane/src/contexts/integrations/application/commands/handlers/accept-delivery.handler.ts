import type { AcceptDeliveryCommand } from '@integrations/application/commands/accept-delivery.command';
import type { DeliveryQueuePort } from '@integrations/application/ports/delivery-queue.port';
import type { ProviderForDelivery } from '@integrations/application/services/provider-for-delivery.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export class AcceptDeliveryHandler
  implements CommandHandlerPort<AcceptDeliveryCommand, void>
{
  constructor(
    private readonly providers: ProviderForDelivery,
    private readonly queue: DeliveryQueuePort,
  ) {}

  async execute(command: AcceptDeliveryCommand): Promise<void> {
    try {
      const provider = await this.providers.find({
        integration: command.integration,
        workspaceId: command.workspaceId,
        teamId: command.teamId,
        teamKey: command.teamKey,
      });

      if (!provider) {
        return;
      }

      await this.queue.accept({
        integration: provider.key,
        workspaceId: command.workspaceId,
        teamId: command.teamId,
        teamKey: command.teamKey,
        id: provider.delivery(command.delivered),
        headers: command.delivered.headers,
        body: command.delivered.body,
        attempts: 0,
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

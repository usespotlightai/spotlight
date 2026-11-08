import type { UnsubscribeFromPushCommand } from '@notifications/application/commands/unsubscribe-from-push.command';
import type { PushSubscriptionRepository } from '@notifications/domain/repositories/push-subscription.repository';
import { PushEndpoint } from '@notifications/domain/value-objects/push-endpoint.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class UnsubscribeFromPushHandler
  implements CommandHandlerPort<UnsubscribeFromPushCommand, boolean>
{
  constructor(private readonly subscriptions: PushSubscriptionRepository) {}

  async execute(command: UnsubscribeFromPushCommand): Promise<boolean> {
    try {
      const found = await this.subscriptions.find(
        PushEndpoint.of(command.endpoint),
      );

      if (!found?.belongsTo(UserId.of(command.personId))) {
        return false;
      }

      await this.subscriptions.remove(found);
      return true;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

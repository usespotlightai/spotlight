import type { SubscribeToPushCommand } from '@notifications/application/commands/subscribe-to-push.command';
import { PushSubscription } from '@notifications/domain/aggregates/push-subscription.aggregate';
import type { PushSubscriptionRepository } from '@notifications/domain/repositories/push-subscription.repository';
import { PushEndpoint } from '@notifications/domain/value-objects/push-endpoint.vo';
import { PushKeys } from '@notifications/domain/value-objects/push-keys.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class SubscribeToPushHandler implements CommandHandlerPort<
  SubscribeToPushCommand,
  void
> {
  constructor(
    private readonly subscriptions: PushSubscriptionRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: SubscribeToPushCommand): Promise<void> {
    try {
      const endpoint = PushEndpoint.of(command.endpoint);
      const keys = PushKeys.of({ p256dh: command.p256dh, auth: command.auth });
      const person = UserId.of(command.personId);
      const at = this.clock.now();
      const found = await this.subscriptions.find(endpoint);

      if (!found) {
        await this.subscriptions.add(
          PushSubscription.create({ endpoint, person, keys, at }),
        );
        return;
      }

      const renewed = found.renewedFor(person, keys, at);

      if (renewed !== found) {
        await this.subscriptions.save(renewed);
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

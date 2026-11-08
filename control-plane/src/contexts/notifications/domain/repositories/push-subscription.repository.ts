import type { PushSubscription } from '@notifications/domain/aggregates/push-subscription.aggregate';
import type { PushEndpoint } from '@notifications/domain/value-objects/push-endpoint.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const PUSH_SUBSCRIPTION_REPOSITORY = Symbol(
  'PUSH_SUBSCRIPTION_REPOSITORY',
);

export interface PushSubscriptionRepository {
  find(endpoint: PushEndpoint): Promise<PushSubscription | null>;

  ofPerson(person: UserId): Promise<PushSubscription[]>;

  add(subscription: PushSubscription): Promise<void>;

  save(subscription: PushSubscription): Promise<void>;

  remove(subscription: PushSubscription): Promise<void>;
}

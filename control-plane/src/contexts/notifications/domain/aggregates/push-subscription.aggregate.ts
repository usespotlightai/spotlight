import type { PushEndpoint } from '@notifications/domain/value-objects/push-endpoint.vo';
import type { PushKeys } from '@notifications/domain/value-objects/push-keys.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

interface PushSubscriptionState {
  readonly endpoint: PushEndpoint;
  readonly person: UserId;
  readonly keys: PushKeys;
  readonly createdAt: Date;
  readonly renewedAt: Date;
  readonly version: number;
}

export class PushSubscription {
  private constructor(private readonly state: PushSubscriptionState) {}

  static create(input: {
    endpoint: PushEndpoint;
    person: UserId;
    keys: PushKeys;
    at: Date;
  }): PushSubscription {
    return new PushSubscription({
      endpoint: input.endpoint,
      person: input.person,
      keys: input.keys,
      createdAt: input.at,
      renewedAt: input.at,
      version: 0,
    });
  }

  static rehydrate(state: PushSubscriptionState): PushSubscription {
    if (state.version < 0) {
      throw new InconsistentStateError(
        'push subscription',
        'has a negative version',
      );
    }

    if (state.renewedAt < state.createdAt) {
      throw new InconsistentStateError(
        'push subscription',
        'was renewed before it was created',
      );
    }

    return new PushSubscription(state);
  }

  get endpoint(): PushEndpoint {
    return this.state.endpoint;
  }

  get person(): UserId {
    return this.state.person;
  }

  get keys(): PushKeys {
    return this.state.keys;
  }

  get createdAt(): Date {
    return this.state.createdAt;
  }

  get renewedAt(): Date {
    return this.state.renewedAt;
  }

  get version(): number {
    return this.state.version;
  }

  belongsTo(person: UserId): boolean {
    return this.state.person.equals(person);
  }

  renewedFor(person: UserId, keys: PushKeys, at: Date): PushSubscription {
    if (this.belongsTo(person) && this.state.keys.equals(keys)) {
      return this;
    }

    return new PushSubscription({
      ...this.state,
      person,
      keys,
      createdAt: this.belongsTo(person) ? this.state.createdAt : at,
      renewedAt: at,
    });
  }
}

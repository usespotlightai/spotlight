import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { Retry } from '@shared-kernel/domain/value-objects/retry.vo';

// The outbox row of the event that a subscriber gets: its id and when the outbox recorded it.
export interface OutboxRecord {
  readonly id: string;
  readonly recordedAt: Date;
}

export interface DomainEventSubscriber {
  readonly name: string;

  readonly kinds: readonly string[];

  readonly callsOut: boolean;

  // How often the outbox tries a failed delivery, and how long it waits between attempts. After the last attempt, the delivery is a dead letter. Without it, the outbox default applies.
  readonly retry?: Retry;

  handle(
    event: DomainEvent,
    record: OutboxRecord,
  ): Promise<readonly DomainEvent[]>;
}

export const subscribing = <E extends DomainEvent>(
  name: string,
  kinds: readonly string[],
  handle: (event: E, record: OutboxRecord) => Promise<unknown>,
  {
    callsOut = false,
    retry,
  }: { readonly callsOut?: boolean; readonly retry?: Retry } = {},
): DomainEventSubscriber => ({
  name,
  kinds,
  callsOut,
  ...(retry ? { retry } : {}),
  handle: async (event, record) => {
    const raised = await handle(event as E, record);

    return Array.isArray(raised) ? (raised as readonly DomainEvent[]) : [];
  },
});

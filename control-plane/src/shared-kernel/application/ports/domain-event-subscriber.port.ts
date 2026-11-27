import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

// The outbox record of the event that a subscriber gets: its id and when the outbox recorded it.
export interface OutboxRecord {
  readonly id: string;
  readonly recordedAt: Date;
}

export interface DomainEventSubscriber {
  readonly name: string;

  readonly kinds: readonly string[];

  readonly callsOut: boolean;

  handle(
    event: DomainEvent,
    record: OutboxRecord,
  ): Promise<readonly DomainEvent[]>;
}

export const subscribing = <E extends DomainEvent>(
  name: string,
  kinds: readonly string[],
  handle: (event: E, record: OutboxRecord) => Promise<unknown>,
  { callsOut } = { callsOut: false },
): DomainEventSubscriber => ({
  name,
  kinds,
  callsOut,
  handle: async (event, record) => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const raised = await handle(event as E, record);

    return Array.isArray(raised) ? (raised as readonly DomainEvent[]) : [];
  },
});

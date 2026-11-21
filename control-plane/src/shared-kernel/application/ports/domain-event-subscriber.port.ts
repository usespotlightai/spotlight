import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { Retry } from '@shared-kernel/domain/value-objects/retry.vo';

// The outbox tries a failed delivery 8 times. It waits 2 seconds after the first attempt, twice as long after each next one, and never longer than one hour.
export const DEFAULT_RETRY = Retry.backoff({
  maxAttempts: 8,
  initialDelayMs: 2_000,
  maxDelayMs: 60 * 60 * 1000,
});

// The outbox record of the event that a subscriber gets.
export interface EventEnvelope {
  readonly id: string;
  readonly recordedAt: Date;
}

export interface DomainEventSubscriber {
  readonly name: string;

  readonly kinds: readonly string[];

  readonly callsOut: boolean;

  // How often the outbox tries a failed delivery, and how long it waits between attempts. After the last attempt, the delivery is a dead letter.
  readonly retry: Retry;

  handle(
    event: DomainEvent,
    envelope: EventEnvelope,
  ): Promise<readonly DomainEvent[]>;
}

export const subscribing = <E extends DomainEvent>(
  name: string,
  kinds: readonly string[],
  handle: (event: E, envelope: EventEnvelope) => Promise<unknown>,
  {
    callsOut = false,
    retry = DEFAULT_RETRY,
  }: { readonly callsOut?: boolean; readonly retry?: Retry } = {},
): DomainEventSubscriber => ({
  name,
  kinds,
  callsOut,
  retry,
  handle: async (event, envelope) => {
    const raised = await handle(event as E, envelope);

    return Array.isArray(raised) ? (raised as readonly DomainEvent[]) : [];
  },
});

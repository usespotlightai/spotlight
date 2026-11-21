import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

// Spotlight tries a failed delivery again after 2^attempts seconds, but never waits longer than maxBackoffMs. After maxAttempts, the delivery is a dead letter.
export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly maxBackoffMs: number;
}

export const DEFAULT_RETRIES: RetryPolicy = {
  maxAttempts: 8,
  maxBackoffMs: 60 * 60 * 1000,
};

// The outbox record of the event that a subscriber gets.
export interface EventEnvelope {
  readonly id: string;
  readonly recordedAt: Date;
}

export interface DomainEventSubscriber {
  readonly name: string;

  readonly kinds: readonly string[];

  // The subscriber also hears each integration event whose kind starts with one of these. An empty prefix matches every integration event. It never matches a domain event.
  readonly integrationEventPrefixes: readonly string[];

  readonly callsOut: boolean;

  readonly retries: RetryPolicy;

  handle(
    event: DomainEvent,
    envelope?: EventEnvelope,
  ): Promise<readonly DomainEvent[]>;
}

export const subscribing = <E extends DomainEvent>(
  name: string,
  kinds: readonly string[],
  handle: (event: E) => Promise<unknown>,
  {
    callsOut = false,
    retries = DEFAULT_RETRIES,
  }: { readonly callsOut?: boolean; readonly retries?: RetryPolicy } = {},
): DomainEventSubscriber => ({
  name,
  kinds,
  integrationEventPrefixes: [],
  callsOut,
  retries,
  handle: async (event) => {
    const raised = await handle(event as E);

    return Array.isArray(raised) ? (raised as readonly DomainEvent[]) : [];
  },
});

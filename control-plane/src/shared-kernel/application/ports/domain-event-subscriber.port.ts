import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export interface DomainEventSubscriber {
  readonly name: string;

  readonly kinds: readonly string[];

  handle(event: DomainEvent): Promise<readonly DomainEvent[]>;
}

export const subscribing = <E extends DomainEvent>(
  name: string,
  kinds: readonly string[],
  handle: (event: E) => Promise<unknown>,
): DomainEventSubscriber => ({
  name,
  kinds,
  handle: async (event) => {
    const raised = await handle(event as E);

    return Array.isArray(raised) ? (raised as readonly DomainEvent[]) : [];
  },
});

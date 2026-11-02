import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export interface DomainEventSubscriber {
  readonly name: string;

  readonly kinds: readonly string[];

  readonly callsOut: boolean;

  handle(event: DomainEvent): Promise<readonly DomainEvent[]>;
}

export const subscribing = <E extends DomainEvent>(
  name: string,
  kinds: readonly string[],
  handle: (event: E) => Promise<unknown>,
  { callsOut } = { callsOut: false },
): DomainEventSubscriber => ({
  name,
  kinds,
  callsOut,
  handle: async (event) => {
    const raised = await handle(event as E);

    return Array.isArray(raised) ? (raised as readonly DomainEvent[]) : [];
  },
});

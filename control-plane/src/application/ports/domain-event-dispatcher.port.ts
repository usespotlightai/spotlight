import type { DomainEvent } from '@domain/events/domain-event';

export const DOMAIN_EVENT_DISPATCHER = Symbol('DOMAIN_EVENT_DISPATCHER');

export interface DomainEventDispatcher {
  dispatch(events: readonly DomainEvent[]): Promise<void>;
}

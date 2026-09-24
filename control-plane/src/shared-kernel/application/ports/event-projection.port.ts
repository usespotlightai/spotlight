import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export interface EventProjection {
  readonly name: string;

  matches(event: DomainEvent): boolean;

  project(event: DomainEvent): Promise<void>;
}

export const projecting = <E extends DomainEvent>(
  name: string,
  matches: (event: DomainEvent) => event is E,
  project: (event: E) => Promise<void>,
): EventProjection => ({
  name,
  matches,
  project: (event) => project(event as E),
});

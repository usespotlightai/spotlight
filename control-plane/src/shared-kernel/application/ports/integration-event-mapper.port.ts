import type { IntegrationEvent } from '@shared-kernel/application/integration-events/integration-event';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export interface IntegrationEventMapper {
  readonly from: string;

  map(event: DomainEvent, at: Date): IntegrationEvent;
}

export const mapping = <E extends DomainEvent>(
  from: string,
  publish: (event: E, at: Date) => IntegrationEvent,
): IntegrationEventMapper => ({
  from,
  map: (event, at) => publish(event as E, at),
});

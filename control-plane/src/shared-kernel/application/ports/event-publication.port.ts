import type { IntegrationEvent } from '@shared-kernel/application/integration-events/integration-event';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export interface EventPublication {
  readonly from: string;

  publish(event: DomainEvent): IntegrationEvent;
}

export const publishing = <E extends DomainEvent>(
  from: string,
  publish: (event: E) => IntegrationEvent,
): EventPublication => ({
  from,
  publish: (event) => publish(event as E),
});

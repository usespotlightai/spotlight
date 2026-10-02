import type { IntegrationEvent } from '@shared-kernel/application/integration-events/integration-event';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export interface EventPublication {
  readonly from: string;

  publish(event: DomainEvent, at: Date): IntegrationEvent;
}

export const publishing = <E extends DomainEvent>(
  from: string,
  publish: (event: E, at: Date) => IntegrationEvent,
): EventPublication => ({
  from,
  publish: (event, at) => publish(event as E, at),
});

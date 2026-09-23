import type { IntegrationLinksPort } from '@configuration/application/ports/integration-links.port';
import {
  HOST_CONNECTED,
  type HostConnectedIntegrationEvent,
} from '@shared-kernel/application/integration-events/host-connected.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const configurationSubscribers = (
  links: IntegrationLinksPort,
): readonly DomainEventSubscriber[] => [
  subscribing<HostConnectedIntegrationEvent>(
    'configuration.track-integration-link',
    [HOST_CONNECTED],
    (event) =>
      links.linked(TeamId.of(event.teamId), {
        source: event.source,
        handle: event.handle,
      }),
  ),
];

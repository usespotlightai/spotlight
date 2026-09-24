import type { IntegrationLinksPort } from '@configuration/application/ports/integration-links.port';
import type { AbandonTeamSkills } from '@configuration/application/services/abandon-team-skills.service';
import {
  HOST_CONNECTED,
  type HostConnectedIntegrationEvent,
} from '@shared-kernel/application/integration-events/host-connected.integration-event';
import {
  TEAM_DISBANDED,
  type TeamDisbandedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-disbanded.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const configurationSubscribers = (
  links: IntegrationLinksPort,
  abandoning: AbandonTeamSkills,
): readonly DomainEventSubscriber[] => [
  subscribing<TeamDisbandedIntegrationEvent>(
    'configuration.abandon-skills-of-disbanded-team',
    [TEAM_DISBANDED],
    (event) =>
      abandoning.of(TeamId.of(event.teamId), WorkspaceId.of(event.workspaceId)),
  ),
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

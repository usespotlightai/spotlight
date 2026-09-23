import type { AbandonTeamIntegrations } from '@integrations/application/services/abandon-team-integrations.service';
import {
  TEAM_DISBANDED,
  type TeamDisbandedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-disbanded.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const integrationsSubscribers = (
  abandoning: AbandonTeamIntegrations,
): readonly DomainEventSubscriber[] => [
  subscribing<TeamDisbandedIntegrationEvent>(
    'integrations.abandon-integrations-of-disbanded-team',
    [TEAM_DISBANDED],
    (event) => abandoning.of(TeamId.of(event.teamId)),
  ),
];

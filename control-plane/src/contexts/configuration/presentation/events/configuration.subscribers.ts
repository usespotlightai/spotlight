import type { AbandonTeamProfiles } from '@configuration/application/services/abandon-team-profiles.service';
import type { AbandonTeamSkills } from '@configuration/application/services/abandon-team-skills.service';
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
  abandoning: AbandonTeamSkills,
  abandoningProfiles: AbandonTeamProfiles,
): readonly DomainEventSubscriber[] => [
  subscribing<TeamDisbandedIntegrationEvent>(
    'configuration.abandon-skills-of-disbanded-team',
    [TEAM_DISBANDED],
    (event) =>
      abandoning.of(TeamId.of(event.teamId), WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<TeamDisbandedIntegrationEvent>(
    'configuration.abandon-harness-profiles-of-disbanded-team',
    [TEAM_DISBANDED],
    (event) =>
      abandoningProfiles.of(
        TeamId.of(event.teamId),
        WorkspaceId.of(event.workspaceId),
      ),
  ),
];

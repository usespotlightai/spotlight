import type { DeleteTeamProfiles } from '@configuration/application/services/delete-team-profiles.service';
import type { DeleteTeamSkills } from '@configuration/application/services/delete-team-skills.service';
import {
  TEAM_DELETED,
  type TeamDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-deleted.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const configurationSubscribers = (
  deletingSkills: DeleteTeamSkills,
  deletingProfiles: DeleteTeamProfiles,
): readonly DomainEventSubscriber[] => [
  subscribing<TeamDeletedIntegrationEvent>(
    'configuration.delete-skills-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      deletingSkills.deleteForTeam(
        TeamId.of(event.teamId),
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'configuration.delete-harness-profiles-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      deletingProfiles.deleteForTeam(
        TeamId.of(event.teamId),
        WorkspaceId.of(event.workspaceId),
      ),
  ),
];

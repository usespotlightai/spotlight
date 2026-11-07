import type { DeleteTeamProfiles } from '@configuration/application/services/delete-team-profiles.service';
import type { DeleteTeamSkills } from '@configuration/application/services/delete-team-skills.service';
import type { DeleteWorkspaceStates } from '@configuration/application/services/delete-workspace-states.service';
import type { PruneStateBodies } from '@configuration/application/services/prune-state-bodies.service';
import type { TerraformStateWritten } from '@configuration/domain/events/terraform-state-written.event';
import {
  TEAM_DELETED,
  type TeamDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-deleted.integration-event';
import {
  WORKSPACE_DELETED,
  type WorkspaceDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-deleted.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const configurationSubscribers = (
  deletingSkills: DeleteTeamSkills,
  deletingProfiles: DeleteTeamProfiles,
  deletingStates: DeleteWorkspaceStates,
  pruning: PruneStateBodies,
): readonly DomainEventSubscriber[] => [
  subscribing<TeamDeletedIntegrationEvent>(
    'configuration.delete-skills-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      deletingSkills.deleteForTeam(
        TeamId.of(event.teamId),
        WorkspaceId.of(event.workspaceId),
      ),
    { callsOut: true },
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'configuration.delete-harness-profiles-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      deletingProfiles.deleteForTeam(
        TeamId.of(event.teamId),
        WorkspaceId.of(event.workspaceId),
      ),
    { callsOut: true },
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'configuration.delete-terraform-states-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      deletingStates.deleteForWorkspace(WorkspaceId.of(event.workspaceId)),
    { callsOut: true },
  ),
  subscribing<TerraformStateWritten>(
    'configuration.remove-dropped-terraform-state-bodies',
    ['terraform-state.written'],
    (event) => pruning.onWritten(event),
    { callsOut: true },
  ),
];

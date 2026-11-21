import {
  CLEAR_DEFAULT_ASSIGNEES,
  type ClearDefaultAssignees,
} from '@lines/application/events/handlers/clear-default-assignees.handler';
import type { DeleteTeamLines } from '@lines/application/events/handlers/delete-team-lines.handler';
import {
  SEED_LINES,
  type SeedLines,
} from '@lines/application/events/handlers/seed-lines.handler';
import {
  TEAM_CREATED,
  type TeamCreatedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-created.integration-event';
import {
  TEAM_DELETED,
  type TeamDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-deleted.integration-event';
import {
  WORKSPACE_MEMBER_ACCESS_ENDED,
  type WorkspaceMemberAccessEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-member-access-ended.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const linesSubscribers = (reactions: {
  seeding: SeedLines;
  deleting: DeleteTeamLines;
  clearing: ClearDefaultAssignees;
}): readonly DomainEventSubscriber[] => [
  subscribing<TeamCreatedIntegrationEvent>(
    SEED_LINES,
    [TEAM_CREATED],
    (event) =>
      reactions.seeding.seed({
        workspaceId: WorkspaceId.of(event.workspaceId),
        teamId: TeamId.of(event.teamId),
        origin: event.origin,
      }),
    { callsOut: true },
  ),
  subscribing<WorkspaceMemberAccessEndedIntegrationEvent>(
    CLEAR_DEFAULT_ASSIGNEES,
    [WORKSPACE_MEMBER_ACCESS_ENDED],
    (event) =>
      reactions.clearing.clearOf(
        WorkspaceId.of(event.workspaceId),
        UserId.of(event.userId),
      ),
    { callsOut: true },
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'lines.delete-lines-of-deleted-team',
    [TEAM_DELETED],
    (event) => reactions.deleting.deleteForTeam(TeamId.of(event.teamId)),
    { callsOut: true },
  ),
];

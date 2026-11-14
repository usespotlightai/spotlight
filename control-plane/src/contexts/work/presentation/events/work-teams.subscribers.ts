import {
  TEAM_CREATED,
  type TeamCreatedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-created.integration-event';
import {
  TEAM_DELETED,
  type TeamDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-deleted.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ProjectTeam } from '@work/application/events/handlers/project-team.handler';

export const workTeamSubscribers = (
  projecting: ProjectTeam,
): readonly DomainEventSubscriber[] => [
  subscribing<TeamCreatedIntegrationEvent>(
    'work.project-created-team',
    [TEAM_CREATED],
    (event) =>
      projecting.teamCreated({
        teamId: TeamId.of(event.teamId),
        key: event.key,
      }),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'work.forget-deleted-team',
    [TEAM_DELETED],
    (event) => projecting.teamDeleted(TeamId.of(event.teamId)),
  ),
];

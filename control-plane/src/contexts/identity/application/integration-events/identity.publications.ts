import type { TeamCreated } from '@identity/domain/events/team-created.event';
import {
  TEAM_CREATED,
  type TeamCreatedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-created.integration-event';
import { publishing } from '@shared-kernel/application/ports/event-publication.port';

export const IDENTITY_PUBLICATIONS = [
  publishing<TeamCreated>(
    'team.created',
    (event): TeamCreatedIntegrationEvent => ({
      kind: TEAM_CREATED,
      workspaceId: event.workspaceId.value,
      teamId: event.teamId.value,
      ownerId: event.openedBy.value,
    }),
  ),
] as const;

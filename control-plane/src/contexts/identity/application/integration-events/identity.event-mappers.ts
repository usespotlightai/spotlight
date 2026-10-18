import type { TeamCreated } from '@identity/domain/events/team-created.event';
import type { TeamDeleted } from '@identity/domain/events/team-deleted.event';
import type { WorkspaceDeleted } from '@identity/domain/events/workspace-deleted.event';
import {
  TEAM_CREATED,
  type TeamCreatedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-created.integration-event';
import {
  TEAM_DELETED,
  type TeamDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-deleted.integration-event';
import {
  WORKSPACE_DELETED,
  type WorkspaceDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-deleted.integration-event';
import { mapping } from '@shared-kernel/application/ports/integration-event-mapper.port';

export const IDENTITY_EVENT_MAPPERS = [
  mapping<TeamDeleted>(
    'team.deleted',
    (event): TeamDeletedIntegrationEvent => ({
      kind: TEAM_DELETED,
      workspaceId: event.workspaceId.value,
      teamId: event.teamId.value,
      key: event.key.value,
    }),
  ),
  mapping<WorkspaceDeleted>(
    'workspace.deleted',
    (event): WorkspaceDeletedIntegrationEvent => ({
      kind: WORKSPACE_DELETED,
      workspaceId: event.workspaceId.value,
      slug: event.slug.value,
    }),
  ),
  mapping<TeamCreated>(
    'team.created',
    (event): TeamCreatedIntegrationEvent => ({
      kind: TEAM_CREATED,
      workspaceId: event.workspaceId.value,
      teamId: event.teamId.value,
      ownerId: event.createdBy.value,
      origin: event.origin,
    }),
  ),
] as const;

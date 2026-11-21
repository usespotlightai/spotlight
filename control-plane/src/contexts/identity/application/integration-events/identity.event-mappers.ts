import type { TeamCreated } from '@identity/domain/events/team-created.event';
import type { TeamDeleted } from '@identity/domain/events/team-deleted.event';
import type { WorkspaceDeleted } from '@identity/domain/events/workspace-deleted.event';
import type { WorkspaceMemberLeft } from '@identity/domain/events/workspace-member-left.event';
import type { WorkspaceMemberSuspended } from '@identity/domain/events/workspace-member-suspended.event';
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
import {
  WORKSPACE_MEMBER_ACCESS_ENDED,
  type WorkspaceMemberAccessEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-member-access-ended.integration-event';
import { mapping } from '@shared-kernel/application/ports/integration-event-mapper.port';

const accessEnded = (
  event: WorkspaceMemberSuspended | WorkspaceMemberLeft,
): WorkspaceMemberAccessEndedIntegrationEvent => ({
  kind: WORKSPACE_MEMBER_ACCESS_ENDED,
  workspaceId: event.workspaceId.value,
  userId: event.userId.value,
});

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
  mapping<WorkspaceMemberSuspended>(
    'workspace.member-suspended',
    (event): WorkspaceMemberAccessEndedIntegrationEvent => accessEnded(event),
  ),
  mapping<WorkspaceMemberLeft>(
    'workspace.member-left',
    (event): WorkspaceMemberAccessEndedIntegrationEvent => accessEnded(event),
  ),
] as const;

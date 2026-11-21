import type { TeamCreated } from '@identity/domain/events/team-created.event';
import type { TeamDeleted } from '@identity/domain/events/team-deleted.event';
import type { WorkspaceCreated } from '@identity/domain/events/workspace-created.event';
import type { WorkspaceDeleted } from '@identity/domain/events/workspace-deleted.event';
import type { WorkspaceMemberJoined } from '@identity/domain/events/workspace-member-joined.event';
import type { WorkspaceMemberRoleChanged } from '@identity/domain/events/workspace-member-role-changed.event';
import {
  TEAM_CREATED,
  type TeamCreatedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-created.integration-event';
import {
  TEAM_DELETED,
  type TeamDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-deleted.integration-event';
import {
  WORKSPACE_CREATED,
  type WorkspaceCreatedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-created.integration-event';
import {
  WORKSPACE_DELETED,
  type WorkspaceDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-deleted.integration-event';
import {
  WORKSPACE_MEMBER_JOINED,
  type WorkspaceMemberJoinedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-member-joined.integration-event';
import {
  WORKSPACE_MEMBER_ROLE_CHANGED,
  type WorkspaceMemberRoleChangedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-member-role-changed.integration-event';
import { mapping } from '@shared-kernel/application/ports/integration-event-mapper.port';

export const IDENTITY_EVENT_MAPPERS = [
  mapping<WorkspaceCreated>(
    'workspace.created',
    (event): WorkspaceCreatedIntegrationEvent => ({
      kind: WORKSPACE_CREATED,
      workspaceId: event.workspaceId.value,
    }),
  ),
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
  mapping<WorkspaceMemberJoined>(
    'workspace.member-joined',
    (event): WorkspaceMemberJoinedIntegrationEvent => ({
      kind: WORKSPACE_MEMBER_JOINED,
      workspaceId: event.workspaceId.value,
      userId: event.userId.value,
      role: event.role.value,
    }),
  ),
  mapping<WorkspaceMemberRoleChanged>(
    'workspace.member-role-changed',
    (event): WorkspaceMemberRoleChangedIntegrationEvent => ({
      kind: WORKSPACE_MEMBER_ROLE_CHANGED,
      workspaceId: event.workspaceId.value,
      userId: event.userId.value,
      role: event.now.value,
    }),
  ),
] as const;

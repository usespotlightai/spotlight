import type { TeamCreated } from '@identity/domain/events/team-created.event';
import type { TeamDisbanded } from '@identity/domain/events/team-disbanded.event';
import type { WorkspaceClosed } from '@identity/domain/events/workspace-closed.event';
import {
  TEAM_CREATED,
  type TeamCreatedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-created.integration-event';
import {
  TEAM_DISBANDED,
  type TeamDisbandedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-disbanded.integration-event';
import {
  WORKSPACE_CLOSED,
  type WorkspaceClosedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-closed.integration-event';
import { publishing } from '@shared-kernel/application/ports/event-publication.port';

export const IDENTITY_PUBLICATIONS = [
  publishing<TeamDisbanded>(
    'team.disbanded',
    (event): TeamDisbandedIntegrationEvent => ({
      kind: TEAM_DISBANDED,
      workspaceId: event.workspaceId.value,
      teamId: event.teamId.value,
      key: event.key.value,
    }),
  ),
  publishing<WorkspaceClosed>(
    'workspace.closed',
    (event): WorkspaceClosedIntegrationEvent => ({
      kind: WORKSPACE_CLOSED,
      workspaceId: event.workspaceId.value,
      slug: event.slug.value,
    }),
  ),
  publishing<TeamCreated>(
    'team.created',
    (event): TeamCreatedIntegrationEvent => ({
      kind: TEAM_CREATED,
      workspaceId: event.workspaceId.value,
      teamId: event.teamId.value,
      ownerId: event.openedBy.value,
      origin: event.origin,
    }),
  ),
] as const;

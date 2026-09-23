import type { TeamCreated } from '@identity/domain/events/team-created.event';
import type { TeamDisbanded } from '@identity/domain/events/team-disbanded.event';
import type { TeamRedefined } from '@identity/domain/events/team-redefined.event';
import type { WorkspaceClosed } from '@identity/domain/events/workspace-closed.event';
import type { WorkspaceRedefined } from '@identity/domain/events/workspace-redefined.event';
import {
  TEAM_CREATED,
  type TeamCreatedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-created.integration-event';
import {
  TEAM_DISBANDED,
  type TeamDisbandedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-disbanded.integration-event';
import {
  TEAM_REDEFINED,
  type TeamRedefinedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-redefined.integration-event';
import {
  WORKSPACE_CLOSED,
  type WorkspaceClosedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-closed.integration-event';
import {
  WORKSPACE_REDEFINED,
  type WorkspaceRedefinedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-redefined.integration-event';
import { publishing } from '@shared-kernel/application/ports/event-publication.port';

const teamFields = (event: TeamRedefined | TeamDisbanded) => ({
  workspaceId: event.workspaceId.value,
  teamId: event.teamId.value,
  key: event.key.value,
});

export const IDENTITY_PUBLICATIONS = [
  publishing<TeamRedefined>(
    'team.redefined',
    (event): TeamRedefinedIntegrationEvent => ({
      kind: TEAM_REDEFINED,
      ...teamFields(event),
    }),
  ),
  publishing<TeamDisbanded>(
    'team.disbanded',
    (event): TeamDisbandedIntegrationEvent => ({
      kind: TEAM_DISBANDED,
      ...teamFields(event),
    }),
  ),
  publishing<WorkspaceRedefined>(
    'workspace.redefined',
    (event): WorkspaceRedefinedIntegrationEvent => ({
      kind: WORKSPACE_REDEFINED,
      workspaceId: event.workspaceId.value,
      name: event.name.value,
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

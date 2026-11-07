import {
  FIRST_TEAM,
  type FirstTeam,
} from '@identity/application/services/first-team.service';
import {
  type InviteMemberships,
  JOIN_TEAMS_ON_ACCEPT,
  JOIN_WORKSPACE_ON_ACCEPT,
} from '@identity/application/services/invite-memberships.service';
import type { IssuedTokens } from '@identity/application/services/issued-tokens.service';
import {
  REMOVE_INVITES_OF_DELETED_WORKSPACE,
  type WorkspaceInviteRemoval,
} from '@identity/application/services/workspace-invite-removal.service';
import {
  MARK_WORKSPACE_SET_UP,
  type WorkspaceSetup,
} from '@identity/application/services/workspace-setup.service';
import type { OidcTrustDeleted } from '@identity/domain/events/oidc-trust-deleted.event';
import type { TeamCreated } from '@identity/domain/events/team-created.event';
import type { WorkspaceCreated } from '@identity/domain/events/workspace-created.event';
import type { WorkspaceDeleted } from '@identity/domain/events/workspace-deleted.event';
import type { WorkspaceInviteAccepted } from '@identity/domain/events/workspace-invite-accepted.event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';

export const identitySubscribers = (
  memberships: InviteMemberships,
  firstTeam: FirstTeam,
  issuedTokens: IssuedTokens,
  inviteRemoval: WorkspaceInviteRemoval,
  setup: WorkspaceSetup,
): readonly DomainEventSubscriber[] => [
  subscribing<WorkspaceCreated>(FIRST_TEAM, ['workspace.created'], (event) =>
    firstTeam.createFor(event),
  ),
  subscribing<WorkspaceInviteAccepted>(
    JOIN_WORKSPACE_ON_ACCEPT,
    ['workspace-invite.accepted'],
    (event) => memberships.joinWorkspace(event),
  ),
  subscribing<WorkspaceInviteAccepted>(
    JOIN_TEAMS_ON_ACCEPT,
    ['workspace-invite.accepted'],
    (event) => memberships.joinTeams(event),
    { callsOut: true },
  ),
  subscribing<OidcTrustDeleted>(
    'identity.revoke-tokens-issued-by-deleted-trust',
    ['oidc-trust.deleted'],
    (event) => issuedTokens.revokeIssuedBy(event),
    { callsOut: true },
  ),
  subscribing<WorkspaceDeleted>(
    REMOVE_INVITES_OF_DELETED_WORKSPACE,
    ['workspace.deleted'],
    (event) => inviteRemoval.removeOf(event),
    { callsOut: true },
  ),
  subscribing<TeamCreated>(MARK_WORKSPACE_SET_UP, ['team.created'], (event) =>
    setup.firstTeamCreated(event),
  ),
];

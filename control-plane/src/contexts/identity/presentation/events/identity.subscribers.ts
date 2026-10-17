import {
  FIRST_TEAM,
  type FirstTeam,
} from '@identity/application/services/first-team.service';
import type { InviteMemberships } from '@identity/application/services/invite-memberships.service';
import type { IssuedTokens } from '@identity/application/services/issued-tokens.service';
import type { WorkspaceCreated } from '@identity/domain/events/workspace-created.event';
import type { WorkspaceInviteAccepted } from '@identity/domain/events/workspace-invite-accepted.event';
import type { WorkspaceTokenTrustDeleted } from '@identity/domain/events/workspace-token-trust-deleted.event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';

export const identitySubscribers = (
  memberships: InviteMemberships,
  firstTeam: FirstTeam,
  issuedTokens: IssuedTokens,
): readonly DomainEventSubscriber[] => [
  subscribing<WorkspaceCreated>(FIRST_TEAM, ['workspace.created'], (event) =>
    firstTeam.createFor(event),
  ),
  subscribing<WorkspaceInviteAccepted>(
    'identity.join-on-accept',
    ['workspace-invite.accepted'],
    (event) => memberships.joined(event),
  ),
  subscribing<WorkspaceTokenTrustDeleted>(
    'identity.revoke-tokens-issued-by-deleted-trust',
    ['workspace-token-trust.deleted'],
    (event) => issuedTokens.revokeIssuedBy(event),
  ),
];

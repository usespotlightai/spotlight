import {
  FIRST_TEAM,
  type FirstTeam,
} from '@identity/application/services/first-team.service';
import type { InviteMemberships } from '@identity/application/services/invite-memberships.service';
import type { MintedTokens } from '@identity/application/services/minted-tokens.service';
import type { WorkspaceInviteAccepted } from '@identity/domain/events/workspace-invite-accepted.event';
import type { WorkspaceOpened } from '@identity/domain/events/workspace-opened.event';
import type { WorkspaceTokenTrustWithdrawn } from '@identity/domain/events/workspace-token-trust-withdrawn.event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';

export const identitySubscribers = (
  memberships: InviteMemberships,
  firstTeam: FirstTeam,
  minted: MintedTokens,
): readonly DomainEventSubscriber[] => [
  subscribing<WorkspaceOpened>(FIRST_TEAM, ['workspace.opened'], (event) =>
    firstTeam.openFor(event),
  ),
  subscribing<WorkspaceInviteAccepted>(
    'identity.join-on-accept',
    ['workspace-invite.accepted'],
    (event) => memberships.joined(event),
  ),
  subscribing<WorkspaceTokenTrustWithdrawn>(
    'identity.revoke-tokens-minted-through-withdrawn-trust',
    ['workspace-token-trust.withdrawn'],
    (event) => minted.revokeThrough(event),
  ),
];

import type { FirstTeam } from '@identity/application/services/first-team.service';
import type { InviteMemberships } from '@identity/application/services/invite-memberships.service';
import type { InviteAccepted } from '@identity/domain/events/invite-accepted.event';
import type { WorkspaceOpened } from '@identity/domain/events/workspace-opened.event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';

export const identitySubscribers = (
  memberships: InviteMemberships,
  firstTeam: FirstTeam,
): readonly DomainEventSubscriber[] => [
  subscribing<WorkspaceOpened>(
    'identity.first-team',
    ['workspace.opened'],
    (event) => firstTeam.openFor(event),
  ),
  subscribing<InviteAccepted>(
    'identity.join-workspace',
    ['invite.accepted'],
    (event) => memberships.intoWorkspace(event),
  ),
  subscribing<InviteAccepted>(
    'identity.join-team',
    ['invite.accepted'],
    (event) => memberships.intoTeam(event),
  ),
];

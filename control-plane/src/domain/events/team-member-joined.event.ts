import type { DomainEvent } from '@domain/events/domain-event';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { TeamRole } from '@domain/value-objects/team-role.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';

export class TeamMemberJoined implements DomainEvent {
  readonly kind = 'team.member-joined';

  constructor(
    readonly teamId: TeamId,
    readonly userId: UserId,
    readonly role: TeamRole,
  ) {}
}

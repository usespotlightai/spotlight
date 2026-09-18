import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class TeamMemberJoined implements DomainEvent {
  readonly kind = 'team.member-joined';

  constructor(
    readonly teamId: TeamId,
    readonly userId: UserId,
  ) {}
}

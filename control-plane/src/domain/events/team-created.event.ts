import type { DomainEvent } from '@domain/events/domain-event';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export class TeamCreated implements DomainEvent {
  readonly kind = 'team.created';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly owner: UserId,
  ) {}
}

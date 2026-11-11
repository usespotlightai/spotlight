import type { InboxArrivalKind } from '@notifications/domain/value-objects/inbox-sighting.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ItemArrived implements DomainEvent {
  readonly kind = 'inbox-item.arrived';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly person: UserId,
    readonly itemId: string,
    readonly itemKind: InboxArrivalKind,
    readonly title: string,
    readonly summary: string | null,
    readonly askedAt: Date,
  ) {}
}

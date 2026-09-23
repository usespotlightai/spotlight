import type { TeamName } from '@identity/domain/value-objects/team-name.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceOpened implements DomainEvent {
  readonly kind = 'workspace.opened';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly owner: UserId,
    readonly firstTeam: {
      readonly id: TeamId;
      readonly name: TeamName;
    } | null,
  ) {}
}

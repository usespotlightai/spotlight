import type { TeamKey } from '@identity/domain/value-objects/team-key.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class TeamRedefined implements DomainEvent {
  readonly kind = 'team.redefined';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly key: TeamKey,
  ) {}
}

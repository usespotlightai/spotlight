import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ConfigurationMoveStarted implements DomainEvent {
  readonly kind = 'configuration.move-started';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly to: Repository,
  ) {}
}

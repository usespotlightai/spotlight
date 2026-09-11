import type { DomainEvent } from '@domain/events/domain-event';
import type { Repository } from '@domain/value-objects/repository.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export class ConfigurationMoveStarted implements DomainEvent {
  readonly kind = 'team.configuration-move-started';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly to: Repository,
  ) {}
}

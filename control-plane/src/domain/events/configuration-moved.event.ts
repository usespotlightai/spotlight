import type { DomainEvent } from '@domain/events/domain-event';
import type { Repository } from '@domain/value-objects/repository.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export class ConfigurationMoved implements DomainEvent {
  readonly kind = 'team.configuration-moved';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly from: Repository | null,
    readonly to: Repository,
  ) {}
}

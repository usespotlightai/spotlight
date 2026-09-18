import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class DefaultBranchPushed implements DomainEvent {
  readonly kind = 'repository.default-branch-pushed';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly repository: string,
    readonly paths: readonly string[],
  ) {}
}

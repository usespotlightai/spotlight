import type { WorkspaceName } from '@identity/domain/value-objects/workspace-name.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceRedefined implements DomainEvent {
  readonly kind = 'workspace.redefined';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly name: WorkspaceName,
  ) {}
}

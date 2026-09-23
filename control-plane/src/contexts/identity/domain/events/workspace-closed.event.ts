import type { WorkspaceSlug } from '@identity/domain/value-objects/workspace-slug.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceClosed implements DomainEvent {
  readonly kind = 'workspace.closed';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly slug: WorkspaceSlug,
  ) {}
}

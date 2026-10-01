import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class PullRequestForgotten implements DomainEvent {
  readonly kind = 'pull-request.forgotten';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly pullRequest: string,
    readonly updatedAt: Date,
  ) {}
}

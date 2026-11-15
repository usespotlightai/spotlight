import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class JudgeClaimsPullRequestFailed implements DomainEvent {
  readonly kind = 'judge-claims-pull-request.failed';

  constructor(
    readonly revisionId: string,
    readonly workspaceId: WorkspaceId,
    readonly reason: string,
  ) {}
}

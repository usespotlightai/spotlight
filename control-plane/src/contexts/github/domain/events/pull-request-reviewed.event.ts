import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export type ReviewState = 'approved' | 'changes-requested' | 'commented';

export class PullRequestReviewed implements DomainEvent {
  readonly kind = 'pull-request.reviewed';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly pullRequest: string,
    readonly state: ReviewState,
    readonly login: string | null,
    readonly byBot: boolean,
    readonly submittedAt: Date | null,
  ) {}
}

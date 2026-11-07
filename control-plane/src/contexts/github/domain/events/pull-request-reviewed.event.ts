import type { ReviewState } from '@github/domain/value-objects/review-state.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class PullRequestReviewed implements DomainEvent {
  readonly kind = 'pull-request.reviewed';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly pullRequest: PullRequestUrl,
    readonly state: ReviewState,
    readonly login: string | null,
    readonly byBot: boolean,
    readonly submittedAt: Date | null,
  ) {}
}

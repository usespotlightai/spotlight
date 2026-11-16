import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class PullRequestPushed implements DomainEvent {
  readonly kind = 'pull-request.pushed';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly pullRequest: PullRequestUrl,
    readonly repository: Repository,
    readonly head: string,
    readonly baseTip: string,
    readonly pushedBy: string | null,
    readonly byBot: boolean,
    readonly pushedAt: Date,
  ) {}
}

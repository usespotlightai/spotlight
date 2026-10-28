import type { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import type { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ConfigPullRequestFailed implements DomainEvent {
  readonly kind = 'replays.config-pull-request-failed';

  constructor(
    readonly pullRequestId: ConfigPullRequestId,
    readonly workspaceId: WorkspaceId,
    readonly reason: ConfigPullRequestReason,
  ) {}
}

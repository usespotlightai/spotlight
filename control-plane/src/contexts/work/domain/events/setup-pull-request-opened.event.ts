import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';

export class SetupPullRequestOpened implements DomainEvent {
  readonly kind = 'chat.setup-pull-request-opened';

  constructor(
    readonly chatId: ChatId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly pullRequest: PullRequestUrl,
    readonly at: Date,
  ) {}
}

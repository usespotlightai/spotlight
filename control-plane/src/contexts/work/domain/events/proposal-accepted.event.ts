import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import type { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import type { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import type { TaskTitle } from '@work/domain/value-objects/task-title.vo';

export class ProposalAccepted implements DomainEvent {
  readonly kind = 'chat.proposal-accepted';

  constructor(
    readonly chatId: ChatId,
    readonly workspaceId: WorkspaceId,
    readonly position: MessagePosition,
    readonly placement: ProposalPlacement,
    readonly title: TaskTitle,
    readonly description: TaskDescription | null,
    readonly acceptedBy: UserId,
  ) {}
}

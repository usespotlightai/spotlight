import type { DomainEvent } from '@domain/events/domain-event';
import type { ChatId } from '@domain/value-objects/chat-id.vo';
import type { MessagePosition } from '@domain/value-objects/message-position.vo';
import type { ProposalPlacement } from '@domain/value-objects/proposal-placement.vo';
import type { TaskDescription } from '@domain/value-objects/task-description.vo';
import type { TaskTitle } from '@domain/value-objects/task-title.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

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

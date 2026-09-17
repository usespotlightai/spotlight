import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { TaskProposal } from '@work/domain/entities/task-proposal.entity';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import type { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import type { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import type { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import type { TaskTitle } from '@work/domain/value-objects/task-title.vo';

export const CHAT_MESSAGE_KINDS = ['said', 'proposed'] as const;

export type ChatMessageKind = (typeof CHAT_MESSAGE_KINDS)[number];

export class ChatMessage {
  private constructor(
    readonly position: MessagePosition,
    readonly kind: ChatMessageKind,
    readonly body: ChatMessageBody,
    readonly at: Date,
    readonly author: UserId | null,
    readonly runId: RunId | null,
    readonly attachments: readonly Attachment[],
    readonly proposal: TaskProposal | null,
    readonly deliveredAt: Date | null,
  ) {}

  static said(input: {
    position: MessagePosition;
    by: UserId;
    body: ChatMessageBody;
    attachments?: readonly Attachment[];
    at: Date;
  }): ChatMessage {
    return new ChatMessage(
      input.position,
      'said',
      input.body,
      input.at,
      input.by,
      null,
      input.attachments ?? [],
      null,
      null,
    );
  }

  static proposed(input: {
    position: MessagePosition;
    runId: RunId;
    placement: ProposalPlacement;
    title: TaskTitle;
    description: TaskDescription | null;
    at: Date;
  }): ChatMessage {
    return new ChatMessage(
      input.position,
      'proposed',
      ChatMessageBody.of(input.title.value),
      input.at,
      null,
      input.runId,
      [],
      TaskProposal.open(input),
      input.at,
    );
  }

  static rehydrate(input: {
    position: MessagePosition;
    kind: ChatMessageKind;
    body: ChatMessageBody;
    at: Date;
    author: UserId | null;
    runId: RunId | null;
    attachments: readonly Attachment[];
    proposal: TaskProposal | null;
    deliveredAt: Date | null;
  }): ChatMessage {
    if (input.proposal && !input.proposal.position.equals(input.position)) {
      throw new InconsistentStateError(
        'chat message',
        'holds a proposal made somewhere else',
      );
    }

    return new ChatMessage(
      input.position,
      input.kind,
      input.body,
      input.at,
      input.author,
      input.runId,
      input.attachments,
      input.proposal,
      input.deliveredAt,
    );
  }

  get undelivered(): boolean {
    return this.kind === 'said' && this.deliveredAt === null;
  }

  delivered(at: Date): ChatMessage {
    return this.undelivered ? this.with({ deliveredAt: at }) : this;
  }

  settled(proposal: TaskProposal): ChatMessage {
    if (!this.proposal?.equals(proposal)) {
      throw new InconsistentStateError(
        'chat message',
        'cannot take a proposal it did not make',
      );
    }

    return this.with({ proposal });
  }

  equals(other: ChatMessage): boolean {
    return this.position.equals(other.position);
  }

  private with(part: {
    deliveredAt?: Date | null;
    proposal?: TaskProposal | null;
  }): ChatMessage {
    return new ChatMessage(
      this.position,
      this.kind,
      this.body,
      this.at,
      this.author,
      this.runId,
      this.attachments,
      part.proposal !== undefined ? part.proposal : this.proposal,
      part.deliveredAt !== undefined ? part.deliveredAt : this.deliveredAt,
    );
  }
}

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
import { TraceReference } from '@work/domain/value-objects/trace-reference.vo';

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
    readonly traces: readonly TraceReference[],
    readonly proposal: TaskProposal | null,
    readonly deliveredAt: Date | null,
    readonly deliveredTo: RunId | null,
  ) {}

  static said(input: {
    position: MessagePosition;
    by: UserId;
    body: ChatMessageBody;
    attachments?: readonly Attachment[];
    traces?: readonly TraceReference[];
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
      TraceReference.distinct(input.traces ?? []),
      null,
      null,
      null,
    );
  }

  static propose(input: {
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
      [],
      TaskProposal.open(input),
      input.at,
      null,
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
    traces: readonly TraceReference[];
    proposal: TaskProposal | null;
    deliveredAt: Date | null;
    deliveredTo: RunId | null;
  }): ChatMessage {
    if (input.proposal && !input.proposal.position.equals(input.position)) {
      throw new InconsistentStateError(
        'chat message',
        'has a proposal made somewhere else',
      );
    }

    if (input.deliveredTo && !input.deliveredAt) {
      throw new InconsistentStateError(
        'chat message',
        'names a run it was delivered to without saying when',
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
      input.traces,
      input.proposal,
      input.deliveredAt,
      input.deliveredTo,
    );
  }

  get undelivered(): boolean {
    return this.kind === 'said' && this.deliveredAt === null;
  }

  wasDeliveredTo(runId: RunId): boolean {
    return this.deliveredTo?.equals(runId) ?? false;
  }

  delivered(runId: RunId, at: Date): ChatMessage {
    return this.undelivered
      ? this.with({ deliveredAt: at, deliveredTo: runId })
      : this;
  }

  takenBack(): ChatMessage {
    if (this.deliveredTo === null) {
      throw new InconsistentStateError(
        'chat message',
        'was never delivered to a run, so it cannot be taken back',
      );
    }

    return this.with({ deliveredAt: null, deliveredTo: null });
  }

  withProposal(proposal: TaskProposal): ChatMessage {
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
    deliveredTo?: RunId | null;
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
      this.traces,
      part.proposal !== undefined ? part.proposal : this.proposal,
      part.deliveredAt !== undefined ? part.deliveredAt : this.deliveredAt,
      part.deliveredTo !== undefined ? part.deliveredTo : this.deliveredTo,
    );
  }
}

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

export const CHAT_MESSAGE_KINDS = ['message', 'proposed'] as const;

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
    readonly acknowledgedAt: Date | null,
    readonly acknowledgedBy: RunId | null,
  ) {}

  static sent(input: {
    position: MessagePosition;
    by: UserId;
    body: ChatMessageBody;
    attachments?: readonly Attachment[];
    traces?: readonly TraceReference[];
    at: Date;
  }): ChatMessage {
    return new ChatMessage(
      input.position,
      'message',
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
    acknowledgedAt: Date | null;
    acknowledgedBy: RunId | null;
  }): ChatMessage {
    if (input.proposal && !input.proposal.position.equals(input.position)) {
      throw new InconsistentStateError(
        'chat message',
        'has a proposal made somewhere else',
      );
    }

    if (input.acknowledgedBy && !input.acknowledgedAt) {
      throw new InconsistentStateError(
        'chat message',
        'names the run that acknowledged it but not when',
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
      input.acknowledgedAt,
      input.acknowledgedBy,
    );
  }

  get unacknowledged(): boolean {
    return this.kind === 'message' && this.acknowledgedAt === null;
  }

  wasAcknowledgedBy(runId: RunId): boolean {
    return this.acknowledgedBy?.equals(runId) ?? false;
  }

  acknowledge(runId: RunId, at: Date): ChatMessage {
    return this.unacknowledged
      ? this.with({ acknowledgedAt: at, acknowledgedBy: runId })
      : this;
  }

  unacknowledge(): ChatMessage {
    if (this.acknowledgedBy === null) {
      throw new InconsistentStateError(
        'chat message',
        'was never acknowledged by a run, so it cannot be unacknowledged',
      );
    }

    return this.with({ acknowledgedAt: null, acknowledgedBy: null });
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
    acknowledgedAt?: Date | null;
    acknowledgedBy?: RunId | null;
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
      part.acknowledgedAt !== undefined
        ? part.acknowledgedAt
        : this.acknowledgedAt,
      part.acknowledgedBy !== undefined
        ? part.acknowledgedBy
        : this.acknowledgedBy,
    );
  }
}

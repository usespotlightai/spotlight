import { EventRecorder } from '@shared-kernel/domain/aggregates/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ChatMessage } from '@work/domain/entities/chat-message.entity';
import type { TaskProposal } from '@work/domain/entities/task-proposal.entity';
import { ChatHandedToRun } from '@work/domain/events/chat-handed-to-run.event';
import { ChatStarted } from '@work/domain/events/chat-started.event';
import { ProposalAccepted } from '@work/domain/events/proposal-accepted.event';
import { ProposalDismissed } from '@work/domain/events/proposal-dismissed.event';
import { TaskProposed } from '@work/domain/events/task-proposed.event';
import { InvalidChatTransitionError } from '@work/domain/exceptions/invalid-chat-transition.error';
import { NotTheChatStarterError } from '@work/domain/exceptions/not-the-chat-starter.error';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { ChatTitle } from '@work/domain/value-objects/chat-title.vo';
import { Continuity } from '@work/domain/value-objects/continuity.vo';
import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import type { Effort } from '@work/domain/value-objects/effort.vo';
import type { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import type { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import type { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import type { TaskTitle } from '@work/domain/value-objects/task-title.vo';

export class Chat extends EventRecorder {
  private constructor(
    readonly id: ChatId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly startedBy: UserId,
    readonly title: ChatTitle,
    readonly harness: HarnessId,
    readonly model: HarnessModel | null,
    readonly effort: Effort | null,
    readonly repositories: readonly Repository[],
    readonly messages: readonly ChatMessage[],
    readonly currentRunId: RunId | null,
    readonly sessionId: HarnessSession | null,
    readonly runnerId: RunnerId | null,
    readonly createdAt: Date,
    readonly version: number,
  ) {
    super();
  }

  static start(input: {
    workspaceId: WorkspaceId;
    teamId: TeamId;
    startedBy: UserId;
    harness: HarnessId;
    model?: HarnessModel | null;
    effort?: Effort | null;
    repositories?: readonly Repository[];
    body: ChatMessageBody;
    attachments?: readonly Attachment[];
    now: Date;
    newId: () => string;
  }): Chat {
    const opening = ChatMessage.said({
      position: MessagePosition.of(0),
      by: input.startedBy,
      body: input.body,
      attachments: input.attachments,
      at: input.now,
    });

    const chat = new Chat(
      ChatId.of(input.newId()),
      input.workspaceId,
      input.teamId,
      input.startedBy,
      ChatTitle.openedWith(opening.body.value),
      input.harness,
      input.model ?? null,
      input.effort ?? null,
      Chat.distinct(input.repositories ?? []),
      [opening],
      null,
      null,
      null,
      input.now,
      0,
    );

    chat.record(
      new ChatStarted(chat.id, chat.workspaceId, chat.teamId, chat.startedBy),
    );

    return chat;
  }

  static rehydrate(input: {
    id: ChatId;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    startedBy: UserId;
    title: ChatTitle;
    harness: HarnessId;
    model: HarnessModel | null;
    effort: Effort | null;
    repositories: readonly Repository[];
    messages: readonly ChatMessage[];
    currentRunId: RunId | null;
    sessionId: HarnessSession | null;
    runnerId: RunnerId | null;
    createdAt: Date;
    version: number;
  }): Chat {
    if (
      input.messages.some((message, place) => message.position.value !== place)
    ) {
      throw new InconsistentStateError('chat', 'has a gap in what was said');
    }

    return new Chat(
      input.id,
      input.workspaceId,
      input.teamId,
      input.startedBy,
      input.title,
      input.harness,
      input.model,
      input.effort,
      input.repositories,
      input.messages,
      input.currentRunId,
      input.sessionId,
      input.runnerId,
      input.createdAt,
      input.version,
    );
  }

  private static distinct(
    repositories: readonly Repository[],
  ): readonly Repository[] {
    return repositories.filter(
      (each, at) =>
        repositories.findIndex((other) => other.equals(each)) === at,
    );
  }

  isOf(teamId: TeamId): boolean {
    return this.teamId.equals(teamId);
  }

  get running(): boolean {
    return this.currentRunId !== null;
  }

  heldBy(runId: RunId): boolean {
    return this.currentRunId?.equals(runId) ?? false;
  }

  get wantsFollowUp(): boolean {
    return !this.running && this.undelivered.length > 0;
  }

  get undelivered(): readonly ChatMessage[] {
    return this.messages.filter((message) => message.undelivered);
  }

  get allAttachments(): readonly Attachment[] {
    return this.messages.flatMap((message) => message.attachments);
  }

  repositoryNamed(name: string): Repository | null {
    return (
      this.repositories.find(
        (each) => each.name === name || each.value === name,
      ) ?? null
    );
  }

  said(input: {
    by: UserId;
    body: ChatMessageBody;
    attachments?: readonly Attachment[];
    at: Date;
  }): Chat {
    this.refuseStranger(input.by);

    return this.with({
      messages: [
        ...this.messages,
        ChatMessage.said({ ...input, position: this.nextPosition }),
      ],
    });
  }

  handedTo(runId: RunId, at: Date): Chat {
    if (this.running) {
      throw new InvalidChatTransitionError(
        'is already being worked, so a second run cannot take it up',
      );
    }

    const handed = this.with({
      currentRunId: runId,
      messages: this.messages.map((message) => message.delivered(at)),
    });

    handed.record(new ChatHandedToRun(this.id, runId));

    return handed;
  }

  runNeverStarted(runId: RunId): Chat {
    return this.currentRunId?.equals(runId)
      ? this.with({ currentRunId: null })
      : this;
  }

  endedRun(runId: RunId): Chat {
    return this.currentRunId?.equals(runId)
      ? this.with({ currentRunId: null })
      : this;
  }

  workedIn(sessionId: HarnessSession, runnerId: RunnerId | null): Chat {
    return this.with({ sessionId, runnerId });
  }

  deliveredUpTo(position: MessagePosition, at: Date): Chat {
    return this.with({
      messages: this.messages.map((message) =>
        message.position.isAtOrBefore(position)
          ? message.delivered(at)
          : message,
      ),
    });
  }

  stoppableBy(by: UserId): RunId {
    this.refuseStranger(by);

    if (!this.currentRunId) {
      throw new InvalidChatTransitionError(
        'is not being worked, so there is nothing to stop',
      );
    }

    return this.currentRunId;
  }

  continuity(): Continuity {
    return Continuity.of({
      key: ContinuityKey.forChat(this.id.value),
      sessionId: this.sessionId,
      pinnedTo: this.sessionId ? this.runnerId : null,
    });
  }

  proposed(input: {
    runId: RunId;
    placement: ProposalPlacement;
    title: TaskTitle;
    description: TaskDescription | null;
    at: Date;
  }): Chat {
    if (!this.currentRunId?.equals(input.runId)) {
      throw new InvalidChatTransitionError(
        'is not being worked by that run, so it cannot propose anything',
      );
    }

    const message = ChatMessage.proposed({
      ...input,
      position: this.nextPosition,
    });
    const next = this.with({ messages: [...this.messages, message] });

    next.record(new TaskProposed(this.id, message.position, input.placement));

    return next;
  }

  proposalAt(position: MessagePosition): TaskProposal {
    const proposal = this.messages[position.value]?.proposal;

    if (!proposal) {
      throw new InvalidChatTransitionError(
        'proposed nothing there, so there is nothing to settle',
      );
    }

    return proposal;
  }

  accept(position: MessagePosition, by: UserId, at: Date): Chat {
    this.refuseStranger(by);

    const proposal = this.proposalAt(position).accepted(at);
    const next = this.settle(proposal);

    next.record(
      new ProposalAccepted(
        this.id,
        this.workspaceId,
        position,
        proposal.placement,
        proposal.title,
        proposal.description,
        by,
      ),
    );

    return next;
  }

  proposalBecame(position: MessagePosition, taskId: TaskId, at: Date): Chat {
    return this.settle(this.proposalAt(position).createdAs(taskId, at));
  }

  acceptanceFailed(position: MessagePosition): Chat {
    return this.settle(this.proposalAt(position).reopened());
  }

  dismiss(position: MessagePosition, by: UserId, at: Date): Chat {
    this.refuseStranger(by);

    const next = this.settle(this.proposalAt(position).dismissed(at));

    next.record(new ProposalDismissed(this.id, position));

    return next;
  }

  private get nextPosition(): MessagePosition {
    return MessagePosition.of(this.messages.length);
  }

  private refuseStranger(by: UserId): void {
    if (!this.startedBy.equals(by)) {
      throw new NotTheChatStarterError(this.id.value);
    }
  }

  private settle(proposal: TaskProposal): Chat {
    return this.with({
      messages: this.messages.map((message) =>
        message.position.equals(proposal.position)
          ? message.settled(proposal)
          : message,
      ),
    });
  }

  private with(part: {
    messages?: readonly ChatMessage[];
    currentRunId?: RunId | null;
    sessionId?: HarnessSession | null;
    runnerId?: RunnerId | null;
  }): Chat {
    const next = new Chat(
      this.id,
      this.workspaceId,
      this.teamId,
      this.startedBy,
      this.title,
      this.harness,
      this.model,
      this.effort,
      this.repositories,
      part.messages ?? this.messages,
      part.currentRunId !== undefined ? part.currentRunId : this.currentRunId,
      part.sessionId !== undefined ? part.sessionId : this.sessionId,
      part.runnerId !== undefined ? part.runnerId : this.runnerId,
      this.createdAt,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }

  equals(other: Chat): boolean {
    return this.id.equals(other.id);
  }
}

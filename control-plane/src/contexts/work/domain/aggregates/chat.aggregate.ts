import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ChatMessage } from '@work/domain/entities/chat-message.entity';
import type { TaskProposal } from '@work/domain/entities/task-proposal.entity';
import { ChatDispatched } from '@work/domain/events/chat-dispatched.event';
import { ChatStarted } from '@work/domain/events/chat-started.event';
import { ProposalAccepted } from '@work/domain/events/proposal-accepted.event';
import { ProposalDismissed } from '@work/domain/events/proposal-dismissed.event';
import { SetupPullRequestOpened } from '@work/domain/events/setup-pull-request-opened.event';
import { TaskProposed } from '@work/domain/events/task-proposed.event';
import { InvalidChatTransitionError } from '@work/domain/exceptions/invalid-chat-transition.error';
import { InvalidSetupBranchError } from '@work/domain/exceptions/invalid-setup-branch.error';
import { NotASetupChatError } from '@work/domain/exceptions/not-a-setup-chat.error';
import { NotTheChatStarterError } from '@work/domain/exceptions/not-the-chat-starter.error';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import { TraceAccess } from '@work/domain/services/trace-access';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { Branch } from '@work/domain/value-objects/branch.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { ChatTitle } from '@work/domain/value-objects/chat-title.vo';
import type { ConfigHome } from '@work/domain/value-objects/config-home.vo';
import { Continuity } from '@work/domain/value-objects/continuity.vo';
import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import type { Effort } from '@work/domain/value-objects/effort.vo';
import type { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import type { ImprovedStation } from '@work/domain/value-objects/improved-station.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import type { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import type { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import type { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import type { TraceReference } from '@work/domain/value-objects/trace-reference.vo';

export interface ChatAfterRun {
  readonly chat: Chat;
  readonly followsUp: boolean;
}

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
    readonly improving: ImprovedStation | null,
    readonly setup: ConfigHome | null,
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
    traces?: readonly TraceReference[];
    improving?: ImprovedStation | null;
    setup?: ConfigHome | null;
    now: Date;
    newId: () => string;
  }): Chat {
    Chat.assertNoForeignTraces(input.teamId, input.traces ?? []);
    Chat.assertNoForeignStation(input.teamId, input.improving ?? null);

    const opening = ChatMessage.sent({
      position: MessagePosition.of(0),
      by: input.startedBy,
      body: input.body,
      attachments: input.attachments,
      traces: input.traces,
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
      Chat.distinct([
        ...(input.setup ? [input.setup.repository] : []),
        ...(input.repositories ?? []),
      ]),
      input.improving ?? null,
      input.setup ?? null,
      [opening],
      null,
      null,
      null,
      input.now,
      0,
    );

    chat.record(
      new ChatStarted(
        chat.id,
        chat.workspaceId,
        chat.teamId,
        chat.startedBy,
        chat.createdAt,
      ),
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
    improving?: ImprovedStation | null;
    setup?: ConfigHome | null;
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
      throw new InconsistentStateError('chat', 'has a gap in its messages');
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
      input.improving ?? null,
      input.setup ?? null,
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

  hasCurrentRun(runId: RunId): boolean {
    return this.currentRunId?.equals(runId) ?? false;
  }

  get wantsFollowUp(): boolean {
    return !this.running && this.unacknowledged.length > 0;
  }

  get unacknowledged(): readonly ChatMessage[] {
    return this.messages.filter((message) => message.unacknowledged);
  }

  get allAttachments(): readonly Attachment[] {
    return this.messages.flatMap((message) => message.attachments);
  }

  messagesAt(positions: readonly MessagePosition[]): readonly ChatMessage[] {
    return this.messages.filter((message) =>
      positions.some((position) => position.equals(message.position)),
    );
  }

  repositoryNamed(name: string): Repository | null {
    return (
      this.repositories.find(
        (each) => each.name === name || each.value === name,
      ) ?? null
    );
  }

  pushableNamed(name: string): Repository | null {
    const named = this.repositoryNamed(name);

    return named && this.setup?.repository.equals(named) ? named : null;
  }

  addMessage(input: {
    by: UserId;
    body: ChatMessageBody;
    attachments?: readonly Attachment[];
    traces?: readonly TraceReference[];
    model?: HarnessModel | null;
    effort?: Effort | null;
    at: Date;
  }): Chat {
    this.assertStarter(input.by);
    Chat.assertNoForeignTraces(this.teamId, input.traces ?? []);

    return this.with({
      messages: [
        ...this.messages,
        ChatMessage.sent({ ...input, position: this.nextPosition }),
      ],
      model: input.model,
      effort: input.effort,
    });
  }

  mayOpenSetupFrom(runId: RunId, branch: Branch): ConfigHome {
    const setup = this.setup;

    if (!setup) {
      throw new NotASetupChatError(this.id.value);
    }

    if (!this.hasCurrentRun(runId)) {
      throw new InvalidChatTransitionError(
        `Run ${runId.value} no longer works chat ${this.id.value}.`,
      );
    }

    if (branch.isSpotlights) {
      throw new InvalidSetupBranchError(branch.value);
    }

    return setup;
  }

  openSetup(
    runId: RunId,
    branch: Branch,
    pullRequest: PullRequestUrl,
    at: Date,
  ): Chat {
    const setup = this.mayOpenSetupFrom(runId, branch);

    if (!pullRequest.repository?.equals(setup.repository)) {
      throw new InvalidChatTransitionError(
        `Pull request ${pullRequest.value} is not in ${setup.repository.value}.`,
      );
    }

    if (setup.pullRequest) {
      return this;
    }

    const opened = this.with({ setup: setup.opened(pullRequest) });

    opened.record(
      new SetupPullRequestOpened(
        this.id,
        this.workspaceId,
        this.teamId,
        pullRequest,
        at,
      ),
    );

    return opened;
  }

  assignRun(runId: RunId, at: Date): Chat {
    if (this.running) {
      throw new InvalidChatTransitionError(
        `Chat ${this.id.value} is already being worked by a run.`,
      );
    }

    const assigned = this.with({
      currentRunId: runId,
      messages: this.messages.map((message) => message.acknowledge(runId, at)),
    });

    assigned.record(
      new ChatDispatched(
        this.id,
        runId,
        this.unacknowledged.map((message) => message.position),
      ),
    );

    return assigned;
  }

  runKeptNothing(runId: RunId): Chat {
    if (!this.hasCurrentRun(runId)) {
      return this;
    }

    return this.with({
      currentRunId: null,
      messages: this.messages.map((message) =>
        message.wasAcknowledgedBy(runId) ? message.unacknowledge() : message,
      ),
    });
  }

  runEnded(
    runId: RunId,
    ending: {
      readonly session: HarnessSession | null;
      readonly workedBy: RunnerId | null;
      readonly stopped: boolean;
    },
  ): ChatAfterRun {
    if (!this.hasCurrentRun(runId)) {
      return { chat: this, followsUp: false };
    }

    if (!ending.session) {
      return { chat: this.runKeptNothing(runId), followsUp: false };
    }

    const worked = this.endRun(runId).recordSession(
      ending.session,
      ending.workedBy,
    );

    return { chat: worked, followsUp: !ending.stopped && worked.wantsFollowUp };
  }

  endRun(runId: RunId): Chat {
    return this.currentRunId?.equals(runId)
      ? this.with({ currentRunId: null })
      : this;
  }

  recordSession(sessionId: HarnessSession, runnerId: RunnerId | null): Chat {
    return this.with({ sessionId, runnerId });
  }

  acknowledgeUpTo(runId: RunId, position: MessagePosition, at: Date): Chat {
    if (!this.hasCurrentRun(runId)) {
      return this;
    }

    return this.with({
      messages: this.messages.map((message) =>
        message.position.isAtOrBefore(position)
          ? message.acknowledge(runId, at)
          : message,
      ),
    });
  }

  stoppableBy(by: UserId): RunId {
    this.assertStarter(by);

    if (!this.currentRunId) {
      throw new InvalidChatTransitionError(
        `Chat ${this.id.value} is not being worked. There is nothing to stop.`,
      );
    }

    return this.currentRunId;
  }

  continuity(): Continuity {
    return Continuity.of({
      key: ContinuityKey.forChat(this.id.value),
      sessionId: this.sessionId,
    });
  }

  propose(input: {
    runId: RunId;
    placement: ProposalPlacement;
    title: TaskTitle;
    description: TaskDescription | null;
    at: Date;
  }): Chat {
    if (!this.currentRunId?.equals(input.runId)) {
      throw new InvalidChatTransitionError(
        `Only the run working chat ${this.id.value} can propose tasks.`,
      );
    }

    const message = ChatMessage.propose({
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
        `Chat ${this.id.value} has no proposal at that message.`,
      );
    }

    return proposal;
  }

  accept(position: MessagePosition, by: UserId, at: Date): Chat {
    this.assertStarter(by);

    const proposal = this.proposalAt(position).accept(at);
    const next = this.replaceProposal(proposal);

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
    return this.replaceProposal(
      this.proposalAt(position).createdAs(taskId, at),
    );
  }

  recordAcceptanceFailure(position: MessagePosition): Chat {
    return this.replaceProposal(this.proposalAt(position).reopen());
  }

  dismiss(position: MessagePosition, by: UserId, at: Date): Chat {
    this.assertStarter(by);

    const next = this.replaceProposal(this.proposalAt(position).dismiss(at));

    next.record(new ProposalDismissed(this.id, position));

    return next;
  }

  private get nextPosition(): MessagePosition {
    return MessagePosition.of(this.messages.length);
  }

  private static assertNoForeignTraces(
    teamId: TeamId,
    traces: readonly TraceReference[],
  ): void {
    const foreign = traces.find(
      (each) => !TraceAccess.sameTeam(teamId, each.teamId),
    );

    if (foreign) {
      throw new UnknownTaskError(foreign.taskId.value);
    }
  }

  private static assertNoForeignStation(
    teamId: TeamId,
    improving: ImprovedStation | null,
  ): void {
    if (improving && !improving.teamId.equals(teamId)) {
      throw new UnknownStationError(improving.stationId.value);
    }
  }

  private assertStarter(by: UserId): void {
    if (!this.startedBy.equals(by)) {
      throw new NotTheChatStarterError(this.id.value);
    }
  }

  private replaceProposal(proposal: TaskProposal): Chat {
    return this.with({
      messages: this.messages.map((message) =>
        message.position.equals(proposal.position)
          ? message.withProposal(proposal)
          : message,
      ),
    });
  }

  private with(part: {
    model?: HarnessModel | null;
    effort?: Effort | null;
    messages?: readonly ChatMessage[];
    currentRunId?: RunId | null;
    sessionId?: HarnessSession | null;
    runnerId?: RunnerId | null;
    setup?: ConfigHome | null;
  }): Chat {
    const next = new Chat(
      this.id,
      this.workspaceId,
      this.teamId,
      this.startedBy,
      this.title,
      this.harness,
      part.model !== undefined ? part.model : this.model,
      part.effort !== undefined ? part.effort : this.effort,
      this.repositories,
      this.improving,
      part.setup !== undefined ? part.setup : this.setup,
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

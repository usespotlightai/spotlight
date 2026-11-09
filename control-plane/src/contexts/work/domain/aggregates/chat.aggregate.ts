import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Effort } from '@shared-kernel/domain/value-objects/effort.vo';
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
import { ChatDeleted } from '@work/domain/events/chat-deleted.event';
import { ChatRunAssigned } from '@work/domain/events/chat-run-assigned.event';
import { ChatRunNotStarted } from '@work/domain/events/chat-run-not-started.event';
import { ChatStarted } from '@work/domain/events/chat-started.event';
import { ProposalAccepted } from '@work/domain/events/proposal-accepted.event';
import { ProposalDismissed } from '@work/domain/events/proposal-dismissed.event';
import { SetupPullRequestOpened } from '@work/domain/events/setup-pull-request-opened.event';
import { InvalidAttachmentError } from '@work/domain/exceptions/invalid-attachment.error';
import { InvalidChatTransitionError } from '@work/domain/exceptions/invalid-chat-transition.error';
import { MixedRunnerImagesError } from '@work/domain/exceptions/mixed-runner-images.error';
import { NotASetupChatError } from '@work/domain/exceptions/not-a-setup-chat.error';
import { NotTheChatStarterError } from '@work/domain/exceptions/not-the-chat-starter.error';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import { chatPlacement } from '@work/domain/services/chat-placement';
import { TraceAccess } from '@work/domain/services/trace-access';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { ChatMark } from '@work/domain/value-objects/chat-mark.vo';
import type { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import type { ChatRefusal } from '@work/domain/value-objects/chat-refusal';
import { ChatTitle } from '@work/domain/value-objects/chat-title.vo';
import type { CiSetup } from '@work/domain/value-objects/ci-setup.vo';
import type { ConfigFolder } from '@work/domain/value-objects/config-folder.vo';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import type { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import type { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import type { PullRequestStep } from '@work/domain/value-objects/pull-request-step';
import { Resume } from '@work/domain/value-objects/resume.vo';
import type { TargetStation } from '@work/domain/value-objects/target-station.vo';
import type { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import type { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import type { TraceReference } from '@work/domain/value-objects/trace-reference.vo';
import { WorkingCopyRelease } from '@work/domain/value-objects/working-copy-release.vo';

export interface NumberedProposal {
  readonly number: number;
  readonly proposal: TaskProposal;
}

export interface ChatAfterRun {
  readonly chat: Chat;
  readonly followsUp: boolean;
}

export class Chat extends EventRecorder {
  static readonly RUN_API_GRANT = {
    scopes: ['plan'] as const,
    lifetimeMs: 60 * 60 * 1_000,
  };

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
    readonly targetStation: TargetStation | null,
    readonly setup: ConfigFolder | null,
    readonly messages: readonly ChatMessage[],
    readonly marks: readonly ChatMark[],
    readonly currentRunId: RunId | null,
    readonly session: HarnessSession | null,
    readonly claimedBy: RunnerId | null,
    readonly createdAt: Date,
    readonly resolvedAt: Date | null,
    readonly readAt: Date | null,
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
    targetStation?: TargetStation | null;
    setup?: ConfigFolder | null;
    marks?: readonly ChatMark[];
    lines: readonly LineMap[];
    now: Date;
    newId: () => string;
  }): Chat {
    Chat.assertNoForeignTraces(input.teamId, input.traces ?? []);
    Chat.assertNoForeignStation(input.teamId, input.targetStation ?? null);

    const repositories = Chat.distinct([
      ...(input.setup ? [input.setup.repository] : []),
      ...(input.repositories ?? []),
    ]);

    if (!chatPlacement(repositories, input.lines)) {
      throw new MixedRunnerImagesError();
    }

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
      repositories,
      input.targetStation ?? null,
      input.setup ?? null,
      [opening],
      Chat.distinctMarks(input.marks ?? []),
      null,
      null,
      null,
      input.now,
      null,
      null,
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
    targetStation?: TargetStation | null;
    setup?: ConfigFolder | null;
    messages: readonly ChatMessage[];
    marks?: readonly ChatMark[];
    currentRunId: RunId | null;
    session: HarnessSession | null;
    claimedBy: RunnerId | null;
    createdAt: Date;
    resolvedAt: Date | null;
    readAt: Date | null;
    version: number;
  }): Chat {
    if (
      input.messages.some((message, place) => message.position.value !== place)
    ) {
      throw new InconsistentStateError('chat', 'has a gap in its messages');
    }

    if (input.version < 0) {
      throw new InconsistentStateError('chat', 'has a negative version');
    }

    if (
      Chat.distinct(input.repositories).length !== input.repositories.length
    ) {
      throw new InconsistentStateError('chat', 'names a repository twice');
    }

    if (input.resolvedAt && input.resolvedAt < input.createdAt) {
      throw new InconsistentStateError('chat', 'was resolved before it began');
    }

    const setUpIn = input.setup?.repository ?? null;

    if (setUpIn && !input.repositories.some((each) => each.equals(setUpIn))) {
      throw new InconsistentStateError(
        'chat',
        'sets up a repository it does not work in',
      );
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
      input.targetStation ?? null,
      input.setup ?? null,
      input.messages,
      input.marks ?? [],
      input.currentRunId,
      input.session,
      input.claimedBy,
      input.createdAt,
      input.resolvedAt,
      input.readAt,
      input.version,
    );
  }

  private static distinctMarks(
    marks: readonly ChatMark[],
  ): readonly ChatMark[] {
    const finding = marks.filter((each) => each.finds);
    const ambient = marks.filter(
      (each) =>
        !each.finds && !finding.some((other) => other.mark.equals(each.mark)),
    );

    return [...finding, ...ambient].filter(
      (each, at, all) =>
        all.findIndex((other) => other.mark.equals(each.mark)) === at,
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

  get inboxRunning(): boolean {
    return this.running || this.wantsFollowUp;
  }

  get unread(): boolean {
    return this.messages.some(
      (message) =>
        message.author === null && (!this.readAt || message.at > this.readAt),
    );
  }

  resolve(by: UserId, at: Date): Chat {
    this.assertStarter(by);

    return this.resolvedAt ? this : this.with({ resolvedAt: at, readAt: at });
  }

  reopen(by: UserId): Chat {
    this.assertStarter(by);

    return this.resolvedAt ? this.with({ resolvedAt: null }) : this;
  }

  markRead(by: UserId, at: Date): Chat {
    this.assertStarter(by);

    return this.with({ readAt: at });
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

  pendingFor(runId: RunId): readonly ChatMessage[] {
    return this.hasCurrentRun(runId) ? this.unacknowledged : [];
  }

  toolRefusal(declared: DeclaredTool): ChatRefusal | null {
    return declared.approval
      ? { kind: 'approval-needs-a-task', tool: declared.tool }
      : null;
  }

  connectionAskRefusal(providedBy: string): ChatRefusal {
    return { kind: 'connection-needs-a-task', providedBy };
  }

  get allAttachments(): readonly Attachment[] {
    return this.messages.flatMap((message) => message.attachments);
  }

  get sharedAttachments(): readonly Attachment[] {
    return this.messages
      .filter((message) => message.kind === 'message')
      .flatMap((message) => message.attachments);
  }

  attachmentsOf(ids: readonly AttachmentId[]): readonly Attachment[] {
    const distinct = ids.filter(
      (id, at) => ids.findIndex((each) => each.equals(id)) === at,
    );

    return distinct.map((id) => {
      const found = this.sharedAttachments.find((each) => each.id.equals(id));

      if (!found) {
        throw new InvalidAttachmentError(
          `${id.value} is not attached to chat ${this.id.value}`,
        );
      }

      return found;
    });
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

  get fromChannel(): boolean {
    return this.marks.length > 0;
  }

  get proposals(): readonly NumberedProposal[] {
    return this.messages
      .flatMap((message) => (message.proposal ? [message.proposal] : []))
      .map((proposal, at) => ({ number: at + 1, proposal }));
  }

  get openProposals(): readonly NumberedProposal[] {
    return this.proposals.filter((each) => each.proposal.isOpen);
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

  get setupPullRequestStep(): PullRequestStep {
    const pullRequest = this.setup?.pullRequest;

    return pullRequest ? { kind: 'keep', pullRequest } : { kind: 'open' };
  }

  mayOpenSetupFrom(runId: RunId): ConfigFolder {
    const setup = this.setup;

    if (!setup) {
      throw new NotASetupChatError(this.id.value);
    }

    if (!this.hasCurrentRun(runId)) {
      throw new InvalidChatTransitionError(
        `Run ${runId.value} no longer works chat ${this.id.value}.`,
      );
    }

    return setup;
  }

  ciSetUp(ci: CiSetup): Chat {
    if (!this.setup) {
      throw new NotASetupChatError(this.id.value);
    }

    if (this.setup.ci) {
      throw new InvalidChatTransitionError(
        `Chat ${this.id.value} has set up CI already.`,
      );
    }

    return this.with({ setup: this.setup.withCi(ci) });
  }

  openSetup(runId: RunId, pullRequest: PullRequestUrl, at: Date): Chat {
    const setup = this.mayOpenSetupFrom(runId);

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
        `Chat ${this.id.value} already has a run in progress.`,
      );
    }

    const assigned = this.with({
      currentRunId: runId,
      messages: this.messages.map((message) => message.acknowledge(runId, at)),
    });

    assigned.record(
      new ChatRunAssigned(
        this.id,
        runId,
        this.unacknowledged.map((message) => message.position),
      ),
    );

    return assigned;
  }

  runEndedWithoutSession(runId: RunId): Chat {
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

  runNotStarted(runId: RunId): Chat {
    if (!this.hasCurrentRun(runId)) {
      return this;
    }

    const next = this.runEndedWithoutSession(runId);

    next.record(new ChatRunNotStarted(this.id, runId));

    return next;
  }

  runEnded(
    runId: RunId,
    ending: {
      readonly session: HarnessSession | null;
      readonly claimedBy: RunnerId | null;
    },
  ): ChatAfterRun {
    if (!this.hasCurrentRun(runId)) {
      return { chat: this, followsUp: false };
    }

    if (!ending.session) {
      return { chat: this.runEndedWithoutSession(runId), followsUp: false };
    }

    const recorded = this.endRun(runId)
      .recordSession(ending.session, ending.claimedBy)
      .with({ resolvedAt: null });

    return { chat: recorded, followsUp: recorded.wantsFollowUp };
  }

  private endRun(runId: RunId): Chat {
    return this.currentRunId?.equals(runId)
      ? this.with({ currentRunId: null })
      : this;
  }

  private recordSession(
    session: HarnessSession,
    claimedBy: RunnerId | null,
  ): Chat {
    return this.with({ session, claimedBy });
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
        `Chat ${this.id.value} has no run in progress. There is nothing to stop.`,
      );
    }

    return this.currentRunId;
  }

  resume(): Resume {
    return Resume.of({
      session: this.session,
    });
  }

  propose(input: {
    runId: RunId;
    placement: ProposalPlacement;
    title: TaskTitle;
    description: TaskDescription | null;
    attachments?: readonly Attachment[];
    at: Date;
  }): Chat {
    const message = ChatMessage.propose({
      ...input,
      position: this.proposalPositionFor(input.runId),
    });
    return this.with({
      messages: [...this.messages, message],
      resolvedAt: null,
    });
  }

  proposalPositionFor(runId: RunId): MessagePosition {
    if (!this.currentRunId?.equals(runId)) {
      throw new InvalidChatTransitionError(
        `Only the run working chat ${this.id.value} can propose tasks.`,
      );
    }

    return this.nextPosition;
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
        this.messages[position.value]?.attachments ?? [],
        by,
      ),
    );

    return next;
  }

  proposalBecame(position: MessagePosition, taskId: TaskId, at: Date): Chat {
    const created = this.replaceProposal(
      this.proposalAt(position).createdAs(taskId, at),
    );

    return created.openProposals.length === 0
      ? created.with({ resolvedAt: at, readAt: at })
      : created;
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
    targetStation: TargetStation | null,
  ): void {
    if (targetStation && !targetStation.teamId.equals(teamId)) {
      throw new UnknownStationError(targetStation.stationId.value);
    }
  }

  get workingCopyRelease(): WorkingCopyRelease {
    return this.session
      ? WorkingCopyRelease.held()
      : WorkingCopyRelease.since(this.createdAt);
  }

  isStartedBy(by: UserId): boolean {
    return this.startedBy.equals(by);
  }

  private assertStarter(by: UserId): void {
    if (!this.isStartedBy(by)) {
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
    session?: HarnessSession | null;
    claimedBy?: RunnerId | null;
    setup?: ConfigFolder | null;
    resolvedAt?: Date | null;
    readAt?: Date | null;
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
      this.targetStation,
      part.setup !== undefined ? part.setup : this.setup,
      part.messages ?? this.messages,
      this.marks,
      part.currentRunId !== undefined ? part.currentRunId : this.currentRunId,
      part.session !== undefined ? part.session : this.session,
      part.claimedBy !== undefined ? part.claimedBy : this.claimedBy,
      this.createdAt,
      part.resolvedAt !== undefined ? part.resolvedAt : this.resolvedAt,
      part.readAt !== undefined ? part.readAt : this.readAt,
      this.version,
    );

    next.inheritEvents(this);

    return next;
  }

  deleted(): Chat {
    const gone = this.with({ currentRunId: null });

    gone.record(
      new ChatDeleted(
        this.id,
        this.workspaceId,
        this.teamId,
        this.currentRunId,
      ),
    );

    return gone;
  }

  equals(other: Chat): boolean {
    return this.id.equals(other.id);
  }
}

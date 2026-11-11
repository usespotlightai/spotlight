import type { MemberDirectoryPort } from '@identity/application/ports/member-directory.port';
import type { RunFactsPort } from '@runs/application/ports/run-facts.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  Happened,
  InboundAttachment,
} from '@work/application/contracts/happenings.contract';
import {
  HappenedMapper,
  type ReceivedHappening,
} from '@work/application/mappers/happened.mapper';
import { RunReadingMapper } from '@work/application/mappers/run-reading.mapper';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type {
  HappeningReactionsPort,
  HappeningsReaction,
} from '@work/application/ports/happening-reactions.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { ProcessedEventsPort } from '@work/application/ports/processed-events.port';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import { ChannelReplies } from '@work/application/rendering/channel-replies';
import {
  type ChannelAnswer,
  ChannelChats,
} from '@work/application/services/channel-chats.service';
import { correlatedTask } from '@work/application/services/correlated-task';
import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import {
  failedReactionOf,
  HELD,
  REACTED,
} from '@work/application/services/happenings-reaction';
import type { WorkAccess } from '@work/application/services/work-access.service';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { NothingSaidError } from '@work/domain/exceptions/nothing-said.error';
import { ReopenedByNobodyError } from '@work/domain/exceptions/reopened-by-nobody.error';
import { TaskNotReopenableError } from '@work/domain/exceptions/task-not-reopenable.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { Placement } from '@work/domain/services/placement';
import {
  movedTo,
  type OpenedOn,
  type Outcome,
  ReactionFor,
} from '@work/domain/services/reaction-for';
import { TurnWait } from '@work/domain/services/turn-wait';
import { Anchor } from '@work/domain/value-objects/anchor.vo';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { Branch } from '@work/domain/value-objects/branch.vo';
import { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import type { ReviewRequest } from '@work/domain/value-objects/review-request.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

const anchorOf = (
  happened: ReceivedHappening,
  attachments: readonly Attachment[],
): Anchor | null =>
  happened.anchor ??
  (attachments.length > 0
    ? Anchor.of({ body: TaskNoteBody.fromInput('', attachments).value })
    : null);

type Reopening =
  | { readonly task: Task; readonly refused: null }
  | { readonly task: null; readonly refused: string };

const reopenedOrRefused = (reopen: () => Task): Reopening => {
  try {
    return { task: reopen(), refused: null };
  } catch (error) {
    if (error instanceof TaskNotReopenableError) {
      return { task: null, refused: ChannelReplies.taskCompleted };
    }

    if (error instanceof ReopenedByNobodyError) {
      return { task: null, refused: ChannelReplies.unknownPerson };
    }

    if (error instanceof NothingSaidError) {
      return { task: null, refused: ChannelReplies.nothingSaid };
    }

    throw error;
  }
};

const identityOf = (happened: Happened): string =>
  JSON.stringify([
    happened.happening,
    happened.summary,
    happened.state,
    happened.correlationKeys,
    happened.message,
    happened.opens,
    happened.chat,
    (happened.attachments ?? []).map((each) => each.name),
  ]);

export class ReactToHappenings implements HappeningReactionsPort {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly placements: TaskPlacementsPort,
    private readonly lines: LineMapsPort,
    private readonly dispatch: TaskDispatching,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly members: MemberDirectoryPort,
    private readonly files: AttachmentStorePort,
    private readonly processed: ProcessedEventsPort,
    private readonly logger: LoggerPort,
    private readonly channels: ChannelChats,
    private readonly runs: RunFactsPort,
    private readonly teams: Pick<WorkAccess, 'membersOf'>,
  ) {}

  async react(
    workspaceId: WorkspaceId,
    teamId: TeamId | null,
    happenings: readonly Happened[],
    receivedAs: string | null,
  ): Promise<HappeningsReaction> {
    try {
      return (await this.reactToEach(
        workspaceId,
        teamId,
        happenings,
        receivedAs,
      ))
        ? HELD
        : REACTED;
    } catch (error) {
      const failed = failedReactionOf(error);

      if (!failed) {
        throw error;
      }

      return failed;
    }
  }

  private async reactToEach(
    workspaceId: WorkspaceId,
    teamId: TeamId | null,
    happenings: readonly Happened[],
    receivedAs: string | null,
  ): Promise<boolean> {
    let held = false;

    for (const arrived of happenings) {
      const key = receivedAs ? `${receivedAs}\n${identityOf(arrived)}` : null;
      const happened = this.received(workspaceId, arrived);

      if (
        !happened ||
        (key && (await this.processed.wasProcessed(workspaceId, key)))
      ) {
        continue;
      }

      if (key && (await this.heldByATurn(workspaceId, happened))) {
        held = true;
        continue;
      }

      // Fetch outside the transaction, so that a slow service does not lock the task during the download.
      const attachments = await this.storedAttachments(
        workspaceId,
        happened.attachments,
      );

      const answer = await this.transaction.inTransaction(async () =>
        !key ||
        (await this.processed.markProcessed(workspaceId, key, this.clock.now()))
          ? this.reactTo(workspaceId, teamId, happened, attachments)
          : null,
      );

      if (answer) {
        await this.channels.answer(answer);
      }
    }

    return held;
  }

  private async heldByATurn(
    workspaceId: WorkspaceId,
    happened: ReceivedHappening,
  ): Promise<boolean> {
    const task = await correlatedTask(
      this.tasks,
      workspaceId,
      happened.correlationKeys,
    );
    const [run] = task?.currentRunId
      ? await this.runs.of([task.currentRunId])
      : [];

    return run?.suspendedAt
      ? TurnWait.holdsHappening(
          RunReadingMapper.turn(run.turn),
          this.clock.now().getTime() - run.suspendedAt.getTime(),
        )
      : false;
  }

  private received(
    workspaceId: WorkspaceId,
    happened: Happened,
  ): ReceivedHappening | null {
    try {
      return HappenedMapper.toReceivedHappening(happened);
    } catch (error) {
      this.logger.warn(
        {
          workspaceId: workspaceId.value,
          happening: happened.happening,
          reason: error instanceof Error ? error.message : String(error),
        },
        'Left a happening that does not read as one',
      );

      return null;
    }
  }

  private async storedAttachments(
    workspaceId: WorkspaceId,
    arriving: readonly InboundAttachment[],
  ): Promise<Attachment[]> {
    const stored: Attachment[] = [];

    for (const each of arriving) {
      try {
        if (each.size !== null) {
          Attachment.assertSize(each.size);
        }

        const id = this.ids.generate();
        const bytes = await each.fetch();
        const file = Attachment.of({
          id,
          name: each.name,
          contentType: each.contentType,
          size: bytes.byteLength,
        });

        await this.files.save(workspaceId, file, bytes);
        stored.push(file);
      } catch (error) {
        this.logger.warn(
          {
            workspaceId: workspaceId.value,
            file: each.name,
            reason: error instanceof Error ? error.message : String(error),
          },
          'Left behind a file that came with a word',
        );
      }
    }

    return stored;
  }

  private async reactTo(
    workspaceId: WorkspaceId,
    teamId: TeamId | null,
    happened: ReceivedHappening,
    attachments: readonly Attachment[],
  ): Promise<ChannelAnswer | null> {
    if (happened.opens?.review) {
      await this.reviewRequested(
        workspaceId,
        teamId,
        happened,
        happened.opens.review,
        attachments,
      );

      return null;
    }

    const task = await correlatedTask(
      this.tasks,
      workspaceId,
      happened.correlationKeys,
    );

    if (task && ChannelChats.reaches(happened)) {
      return this.mentionedOn(task, happened, attachments);
    }

    if (task) {
      await this.receivedBy(task, happened, attachments);

      return null;
    }

    if (ChannelChats.reaches(happened)) {
      return this.channels.reached(workspaceId, teamId, happened, attachments);
    }

    await this.opened(workspaceId, teamId, happened, attachments);

    return null;
  }

  private async receivedBy(
    received: Task,
    happened: ReceivedHappening,
    attachments: readonly Attachment[],
  ): Promise<void> {
    const merged = happened.payload.closedPullRequest;
    const task = merged
      ? received.pullRequestClosed(merged, this.clock.now())
      : received;
    const line = await this.lines.findByStation(task.stationId);

    if (!line) {
      this.skipped('station-has-no-line', happened, {
        workspaceId: task.workspaceId.value,
        taskId: task.id.value,
      });
      return;
    }

    const updated = await this.applied(
      ReactionFor.happened({
        task,
        line,
        payload: happened.payload,
        anchor: anchorOf(happened, attachments),
      }),
      task,
      attachments,
      happened.authorEmail,
      happened.payload.happening,
    );

    if (!updated) {
      if (task !== received) {
        await this.tasks.save(task);
      }

      this.skipped('no-rule-matched', happened, {
        workspaceId: task.workspaceId.value,
        teamId: line.teamId.value,
        taskId: task.id.value,
      });
      return;
    }

    const runId = updated.wantsRun(line)
      ? await this.dispatch.runIdFor({ task: updated, line })
      : null;

    await this.tasks.save(runId ? updated.assignRun(runId, line) : updated);
  }

  private async mentionedOn(
    task: Task,
    happened: ReceivedHappening,
    attachments: readonly Attachment[],
  ): Promise<ChannelAnswer | null> {
    const line = await this.lines.findByStation(task.stationId);

    if (!line || !task.reopensOnMention) {
      await this.receivedBy(task, { ...happened, anchor: null }, attachments);

      return null;
    }

    const answered = (
      event: ChannelAnswer['event'],
      body = '',
    ): ChannelAnswer => ({
      workspaceId: task.workspaceId,
      teamId: line.teamId,
      happened,
      event,
      body,
    });

    const email = happened.chat?.email;
    const speaker = email
      ? await this.members.byEmail(task.workspaceId, email)
      : null;
    const anchor = anchorOf(happened, attachments);
    const to = task.reopensAt(line, happened.payload.happening);
    const ranks = (await this.placements.placementsAt(to)).map(
      (each) => each.rank,
    );
    const reopening = reopenedOrRefused(() =>
      task.reopen(
        line,
        happened.payload.happening,
        Placement.entering('reacted', ranks),
        {
          line,
          body: TaskNoteBody.receivedHappening(
            happened.payload.summary,
            anchor,
          ),
          at: this.clock.now(),
          voice: speaker ? Voice.person(speaker) : Voice.world(),
          anchor,
          attachments,
        },
      ),
    );

    if (reopening.refused !== null) {
      return answered('chat.refused', reopening.refused);
    }

    const reopened = reopening.task;

    const runId = reopened.wantsRun(line)
      ? await this.dispatch.runIdFor({ task: reopened, line })
      : null;

    await this.tasks.save(runId ? reopened.assignRun(runId, line) : reopened);

    return answered('chat.acknowledged');
  }

  private async reviewRequested(
    workspaceId: WorkspaceId,
    teamId: TeamId | null,
    happened: ReceivedHappening,
    request: ReviewRequest,
    attachments: readonly Attachment[],
  ): Promise<void> {
    if (!happened.opens) {
      this.skipped('opens-nothing', happened, {
        workspaceId: workspaceId.value,
        teamId: teamId?.value,
      });
      return;
    }

    const answer = ReactionFor.reviewRequested({
      lines: await this.linesOf(workspaceId, teamId),
      opens: happened.opens,
      request,
      anchor: happened.anchor,
      branchTask: request.branch
        ? await this.findByBranch(workspaceId, request.branch)
        : null,
      pullRequestTask: await this.findByMark(
        workspaceId,
        Mark.pullRequest(request.pullRequest),
      ),
      reviewTask: await correlatedTask(
        this.tasks,
        workspaceId,
        happened.correlationKeys,
      ),
    });

    if (answer.kind === 'nothing') {
      this.skipped('no-review-policy-takes-it', happened, {
        workspaceId: workspaceId.value,
        teamId: teamId?.value,
      });
    }

    if (answer.kind === 'received') {
      await this.receivedBy(answer.by, happened, attachments);
    }

    if (answer.kind === 'opens') {
      await this.openOn(workspaceId, answer.on, happened, attachments, (task) =>
        task.reviews(
          request.pullRequest,
          { outside: request.outside },
          answer.on.line,
          this.clock.now(),
        ),
      );
    }
  }

  private async findByMark(
    workspaceId: WorkspaceId,
    mark: Mark,
  ): Promise<Task | null> {
    const correlationKeys = CorrelationKeys.of({ marks: [mark] });

    return correlationKeys
      ? correlatedTask(this.tasks, workspaceId, correlationKeys)
      : null;
  }

  private async findByBranch(
    workspaceId: WorkspaceId,
    branch: Branch,
  ): Promise<Task | null> {
    const correlationKeys = CorrelationKeys.of({ branch: branch.value });

    return correlationKeys
      ? correlatedTask(this.tasks, workspaceId, correlationKeys)
      : null;
  }

  private async linesOf(
    workspaceId: WorkspaceId,
    teamId: TeamId | null,
  ): Promise<readonly LineMap[]> {
    return teamId
      ? this.lines.ofTeam(teamId)
      : this.lines.ofWorkspace(workspaceId);
  }

  private async opened(
    workspaceId: WorkspaceId,
    teamId: TeamId | null,
    happened: ReceivedHappening,
    attachments: readonly Attachment[],
  ): Promise<void> {
    if (!happened.opens) {
      this.skipped('no-task-matched', happened, {
        workspaceId: workspaceId.value,
        teamId: teamId?.value,
      });
      return;
    }

    const chosen = ReactionFor.openingOn({
      lines: await this.linesOf(workspaceId, teamId),
      opens: happened.opens,
    });

    if (!chosen) {
      this.skipped('no-line-opens-it', happened, {
        workspaceId: workspaceId.value,
        teamId: teamId?.value,
      });
      return;
    }

    await this.openOn(
      workspaceId,
      chosen,
      happened,
      attachments,
      (task) => task,
    );
  }

  private async openOn(
    workspaceId: WorkspaceId,
    { line, opening }: OpenedOn,
    happened: ReceivedHappening,
    attachments: readonly Attachment[],
    shaped: (task: Task) => Task,
  ): Promise<void> {
    const named = happened.opens?.assignEmail
      ? await this.members.byEmail(workspaceId, happened.opens.assignEmail)
      : null;
    const members = named ? await this.teams.membersOf(line.teamId) : null;
    const now = this.clock.now();

    const added = shaped(
      opening.marks.reduce(
        (task, mark) => task.markedBy(mark, now),
        Task.add({
          line,
          at: opening.at.id,
          title: opening.title,
          description: opening.description,
          attachments,
          receivedFrom: happened.payload.happening,
          rank: Placement.entering(
            'opened',
            (await this.placements.placementsAt(opening.at.id)).map(
              (each) => each.rank,
            ),
          ),
          now,
          newId: () => this.ids.generate(),
        }),
      ),
    );

    const opened =
      named && members ? added.assignedIfMember(named, members) : added;

    const runId = opened.wantsRun(line)
      ? await this.dispatch.runIdFor({ task: opened, line })
      : null;

    const stored = runId ? opened.assignRun(runId, line) : opened;
    await this.tasks.add(stored);
  }

  private skipped(
    reason: string,
    happened: ReceivedHappening,
    ids: Record<string, string | undefined>,
  ): void {
    this.logger.info(
      { ...ids, happening: happened.payload.happening.value, reason },
      'Did not act on a happening',
    );
  }

  private async applied(
    reaction: Outcome,
    task: Task,
    attachments: readonly Attachment[],
    authorEmail: string | null,
    happening: Happening,
  ): Promise<Task | null> {
    if (reaction.kind === 'nothing') {
      return null;
    }

    const author = authorEmail
      ? await this.members.byEmail(task.workspaceId, authorEmail)
      : null;
    const destination = movedTo(reaction);

    return task.reactTo(reaction, {
      at: this.clock.now(),
      voice: Voice.world(author, happening.integration),
      attachments,
      ranksAtDestination: destination
        ? (await this.placements.placementsAt(destination)).map(
            (each) => each.rank,
          )
        : [],
    });
  }
}

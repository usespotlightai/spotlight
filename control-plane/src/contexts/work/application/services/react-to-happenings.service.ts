import type { MemberDirectoryPort } from '@identity/application/ports/member-directory.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  Arriving,
  Happened,
} from '@work/application/contracts/happenings.contract';
import {
  HappenedMapper,
  type Heard,
} from '@work/application/mappers/happened.mapper';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { HappeningReactionsPort } from '@work/application/ports/happening-reactions.port';
import type { HeardHappeningsPort } from '@work/application/ports/heard-happenings.port';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import type { TaskDispatching } from '@work/application/services/task-dispatch';
import { takeWornMarks } from '@work/application/services/worn-marks';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { InvalidAttachmentError } from '@work/domain/exceptions/invalid-attachment.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { Placement } from '@work/domain/services/placement';
import {
  type OpenedOn,
  type Outcome,
  ReactionFor,
} from '@work/domain/services/reaction-for';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { Concerns } from '@work/domain/value-objects/concerns.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import type { ReviewRequest } from '@work/domain/value-objects/review-asked.vo';
import { Said } from '@work/domain/value-objects/said.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';

const spoken = (
  happened: Heard,
  attachments: readonly Attachment[],
): Said | null =>
  happened.said ??
  (attachments.length > 0
    ? Said.of({ body: TaskNoteBody.given('', attachments).value })
    : null);

const identityOf = (happened: Happened): string =>
  JSON.stringify([
    happened.happening,
    happened.told,
    happened.state,
    happened.concerns,
    happened.said,
    happened.opens,
    (happened.attachments ?? []).map((each) => each.name),
  ]);

export class ReactToHappenings implements HappeningReactionsPort {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly placements: TaskPlacementsPort,
    private readonly lines: LineRepository,
    private readonly dispatch: TaskDispatching,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly members: MemberDirectoryPort,
    private readonly files: AttachmentStorePort,
    private readonly heardBefore: HeardHappeningsPort,
    private readonly logger: LoggerPort,
  ) {}

  async react(
    workspaceId: WorkspaceId,
    teamId: TeamId | null,
    happenings: readonly Happened[],
    heardAs: string | null,
  ): Promise<void> {
    for (const arrived of happenings) {
      const key = heardAs ? `${heardAs}\n${identityOf(arrived)}` : null;
      const happened = this.heard(workspaceId, arrived);

      if (
        !happened ||
        (key && (await this.heardBefore.heard(workspaceId, key)))
      ) {
        continue;
      }

      // Fetch outside the transaction, so that a slow host does not hold the task during the download.
      const attachments = await this.kept(workspaceId, happened.attachments);

      await this.transaction.run(async () => {
        if (
          !key ||
          (await this.heardBefore.hearing(workspaceId, key, this.clock.now()))
        ) {
          await this.reactTo(workspaceId, teamId, happened, attachments);
        }
      });
    }
  }

  private heard(workspaceId: WorkspaceId, happened: Happened): Heard | null {
    try {
      return HappenedMapper.toHeard(happened);
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

  private async kept(
    workspaceId: WorkspaceId,
    arriving: readonly Arriving[],
  ): Promise<Attachment[]> {
    const kept: Attachment[] = [];

    for (const each of arriving) {
      try {
        if (each.size !== null && Attachment.tooLarge(each.size)) {
          throw new InvalidAttachmentError('must be no larger than 25 MB');
        }

        const id = this.ids.generate();
        const bytes = await each.fetch();
        const file = Attachment.of({
          id,
          name: each.name,
          contentType: each.contentType,
          size: bytes.byteLength,
        });

        await this.files.keep(workspaceId, file, bytes);
        kept.push(file);
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

    return kept;
  }

  private async reactTo(
    workspaceId: WorkspaceId,
    teamId: TeamId | null,
    happened: Heard,
    attachments: readonly Attachment[],
  ): Promise<void> {
    if (happened.opens?.review) {
      await this.reviewAsked(
        workspaceId,
        teamId,
        happened,
        happened.opens.review,
        attachments,
      );

      return;
    }

    const task = await this.tasks.holding(workspaceId, happened.concerns);

    if (!task) {
      await this.opened(workspaceId, teamId, happened, attachments);

      return;
    }

    await this.heardBy(task, happened, attachments);
  }

  private async heardBy(
    task: Task,
    happened: Heard,
    attachments: readonly Attachment[],
  ): Promise<void> {
    const line = await this.lines.holding(task.stationId);

    if (!line) {
      return;
    }

    const heard = await this.applied(
      ReactionFor.happened({
        task,
        line,
        word: happened.word,
        said: spoken(happened, attachments),
      }),
      task,
      line,
      attachments,
    );

    if (!heard) {
      return;
    }

    const runId = heard.wantsRun(line)
      ? await this.dispatch.runIdFor({ task: heard, line })
      : null;

    await this.tasks.save(runId ? heard.handedTo(runId, line) : heard);
  }

  private async reviewAsked(
    workspaceId: WorkspaceId,
    teamId: TeamId | null,
    happened: Heard,
    request: ReviewRequest,
    attachments: readonly Attachment[],
  ): Promise<void> {
    if (!happened.opens) {
      return;
    }

    const answer = ReactionFor.reviewAsked({
      lines: await this.linesOf(workspaceId, teamId),
      opens: happened.opens,
      request,
      said: happened.said,
      holder: await this.holding(
        workspaceId,
        Mark.pullRequest(request.pullRequest),
      ),
      held: await this.tasks.holding(workspaceId, happened.concerns),
    });

    if (answer.kind === 'heard') {
      await this.heardBy(answer.by, happened, attachments);
    }

    if (answer.kind === 'opens') {
      await this.openOn(workspaceId, answer.on, happened, attachments, (task) =>
        task.reviews(request.pullRequest, { outside: request.outside }),
      );
    }
  }

  private async holding(
    workspaceId: WorkspaceId,
    mark: Mark,
  ): Promise<Task | null> {
    const concerns = Concerns.of({ marks: [mark] });

    return concerns ? this.tasks.holding(workspaceId, concerns) : null;
  }

  private async linesOf(
    workspaceId: WorkspaceId,
    teamId: TeamId | null,
  ): Promise<readonly Line[]> {
    return teamId
      ? this.lines.ofTeam(teamId)
      : this.lines.ofWorkspace(workspaceId);
  }

  private async opened(
    workspaceId: WorkspaceId,
    teamId: TeamId | null,
    happened: Heard,
    attachments: readonly Attachment[],
  ): Promise<void> {
    if (!happened.opens) {
      return;
    }

    const chosen = ReactionFor.openingOn({
      lines: await this.linesOf(workspaceId, teamId),
      opens: happened.opens,
    });

    if (!chosen) {
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
    happened: Heard,
    attachments: readonly Attachment[],
    shaped: (task: Task) => Task,
  ): Promise<void> {
    const assignee = happened.opens?.assignEmail
      ? await this.members.byEmail(workspaceId, happened.opens.assignEmail)
      : null;

    const added = shaped(
      opening.marks.reduce(
        (task, mark) => task.markedBy(mark),
        Task.add({
          line,
          at: opening.at.id,
          title: opening.title,
          description: opening.description,
          attachments,
          heardFrom: happened.word.happening,
          rank: Placement.atTheBack(
            (await this.placements.placementsAt(opening.at.id)).map(
              (each) => each.rank,
            ),
          ),
          now: this.clock.now(),
          newId: () => this.ids.generate(),
        }),
      ),
    );

    const opened = assignee ? added.assignedTo(assignee) : added;

    const runId = opened.wantsRun(line)
      ? await this.dispatch.runIdFor({ task: opened, line })
      : null;

    const stored = runId ? opened.handedTo(runId, line) : opened;
    await takeWornMarks(this.tasks, stored);
    await this.tasks.add(stored);
  }

  private async applied(
    reaction: Outcome,
    task: Task,
    line: Line,
    attachments: readonly Attachment[],
  ): Promise<Task | null> {
    if (reaction.kind === 'nothing') {
      return null;
    }

    const saying = {
      station: reaction.station,
      body: reaction.body,
      at: this.clock.now(),
      voice: Voice.world(),
      said: reaction.said,
      attachments,
    };

    if (reaction.kind === 'stays') {
      return task.heard(saying);
    }

    if (reaction.kind === 'heldBack') {
      return task.heldBack(line, reaction.to.id, saying);
    }

    if (reaction.kind === 'interrupts') {
      return task.interrupted(saying);
    }

    if (reaction.kind === 'answers') {
      return task.answered(reaction.to, saying);
    }

    return task.reactedTo(
      line,
      reaction.to.id,
      Placement.atTheTop(
        (await this.placements.placementsAt(reaction.to.id)).map(
          (each) => each.rank,
        ),
      ),
      saying,
    );
  }
}

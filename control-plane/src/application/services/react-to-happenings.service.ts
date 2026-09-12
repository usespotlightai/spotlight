import type { AttachmentStorePort } from '@application/ports/attachment-store.port';
import type { ClockPort } from '@application/ports/clock.port';
import type { HappeningReactionsPort } from '@application/ports/happening-reactions.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { LoggerPort } from '@application/ports/logger.port';
import type { MemberReaderPort } from '@application/ports/member-reader.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type {
  Arriving,
  Happened,
} from '@application/ports/webhook-source.port';
import type { AnnounceTaskEvents } from '@application/services/announce-task-events';
import type { TaskDispatching } from '@application/services/task-dispatch';
import { Task } from '@domain/aggregates/task.aggregate';
import { InvalidAttachmentError } from '@domain/exceptions/invalid-attachment.error';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { Placement } from '@domain/services/placement';
import { type Outcome, ReactionFor } from '@domain/services/reaction-for';
import { Attachment } from '@domain/value-objects/attachment.vo';
import { Said } from '@domain/value-objects/said.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { Voice } from '@domain/value-objects/voice.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

const spoken = (
  happened: Happened,
  attachments: readonly Attachment[],
): Said | null =>
  happened.said ??
  (attachments.length > 0
    ? Said.of({ body: TaskNoteBody.given('', attachments).value })
    : null);

/**
 * What a word from outside does to the board: it finds the task it concerns and
 * lets the line say what becomes of it, or opens the one task a word nobody has
 * one for calls for. Shared by every trigger — a webhook delivery or a poll —
 * so a word means the same thing however it arrived.
 */
export class ReactToHappenings implements HappeningReactionsPort {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: AssemblyLineRepository,
    private readonly dispatch: TaskDispatching,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
    private readonly ids: IdGeneratorPort,
    private readonly members: MemberReaderPort,
    private readonly announce: AnnounceTaskEvents,
    private readonly files: AttachmentStorePort,
    private readonly logger: LoggerPort,
  ) {}

  /** Each word in its own transaction; one that fails does not undo the rest. */
  async react(
    workspaceId: WorkspaceId,
    teamId: string,
    happenings: readonly Happened[],
  ): Promise<void> {
    for (const happened of happenings) {
      // Fetched before the word is reckoned with rather than during it, so a
      // host slow to hand a file over never holds a task while it does.
      const attachments = await this.kept(
        workspaceId,
        happened.attachments ?? [],
      );

      await this.transaction.run(() =>
        this.reactTo(workspaceId, teamId, happened, attachments),
      );
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
    teamId: string,
    happened: Happened,
    attachments: readonly Attachment[],
  ): Promise<void> {
    const task = await this.tasks.holding(workspaceId, happened.concerns);

    if (!task) {
      await this.opened(workspaceId, teamId, happened, attachments);

      return;
    }

    const line = await this.lines.holding(task.stationId);

    if (!line) {
      return;
    }

    const heard = await this.applied(
      ReactionFor.happened({
        task,
        line,
        word: happened,
        said: spoken(happened, attachments),
      }),
      task,
      attachments,
    );

    if (!heard) {
      return;
    }

    // Asked of the task rather than assumed: work owed to a person is not
    // work to start, however loudly the world knocks.
    const runId = heard.idle
      ? await this.dispatch.dispatch({ task: heard, line })
      : null;

    await this.tasks.save(runId ? heard.handedTo(runId) : heard);
  }

  private async opened(
    workspaceId: WorkspaceId,
    teamId: string,
    happened: Happened,
    attachments: readonly Attachment[],
  ): Promise<void> {
    if (!happened.opens) {
      return;
    }

    const lines = teamId
      ? await this.lines.ofTeam(TeamId.of(teamId))
      : await this.lines.ofWorkspace(workspaceId);

    const chosen = ReactionFor.openingOn({
      lines,
      opens: happened.opens,
    });

    if (!chosen) {
      return;
    }

    const { line, opening } = chosen;

    // Assigned to whoever the delivery named by email, where a member has it;
    // left unassigned otherwise, so a name we cannot place loses nothing.
    const assignee = happened.opens.assignEmail
      ? await this.members.byEmail(workspaceId, happened.opens.assignEmail)
      : null;

    const added = opening.marks.reduce(
      (task, mark) => task.markedBy(mark),
      Task.add({
        workspaceId,
        stationId: opening.at.id,
        title: opening.title,
        description: opening.description,
        attachments,
        rank: Placement.atTheBack(await this.tasks.placementsAt(opening.at.id)),
        now: this.clock.now(),
        newId: () => this.ids.generate(),
      }),
    );

    const opened = assignee ? added.assignedTo(assignee) : added;

    const runId = opened.idle
      ? await this.dispatch.dispatch({ task: opened, line })
      : null;

    const stored = runId ? opened.handedTo(runId) : opened;
    await this.tasks.add(stored);
    await this.announce.of(stored);
  }

  private async applied(
    reaction: Outcome,
    task: Task,
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

    if (reaction.kind === 'answers') {
      return task.answered(reaction.to, saying);
    }

    return task.moveTo(
      reaction.to,
      Placement.atTheTop(await this.tasks.placementsAt(reaction.to.id)),
      saying,
    );
  }
}

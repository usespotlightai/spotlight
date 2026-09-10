import type { ClockPort } from '@application/ports/clock.port';
import type { HappeningReactionsPort } from '@application/ports/happening-reactions.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { MemberReaderPort } from '@application/ports/member-reader.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { Happened } from '@application/ports/webhook-source.port';
import type { TaskDispatching } from '@application/services/task-dispatch';
import { Task } from '@domain/aggregates/task.aggregate';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { Placement } from '@domain/services/placement';
import { type Outcome, ReactionFor } from '@domain/services/reaction-for';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { Voice } from '@domain/value-objects/voice.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

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
  ) {}

  /** Each word in its own transaction; one that fails does not undo the rest. */
  async react(
    workspaceId: WorkspaceId,
    teamId: string,
    happenings: readonly Happened[],
  ): Promise<void> {
    for (const happened of happenings) {
      await this.transaction.run(() =>
        this.reactTo(workspaceId, teamId, happened),
      );
    }
  }

  private async reactTo(
    workspaceId: WorkspaceId,
    teamId: string,
    happened: Happened,
  ): Promise<void> {
    const task = await this.tasks.holding(workspaceId, happened.concerns);

    if (!task) {
      await this.opened(workspaceId, teamId, happened);

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
        said: happened.said,
      }),
      task,
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
        rank: Placement.atTheBack(await this.tasks.placementsAt(opening.at.id)),
        now: this.clock.now(),
        newId: () => this.ids.generate(),
      }),
    );

    const opened = assignee ? added.assignedTo(assignee) : added;

    const runId = opened.idle
      ? await this.dispatch.dispatch({ task: opened, line })
      : null;

    await this.tasks.add(runId ? opened.handedTo(runId) : opened);
  }

  private async applied(reaction: Outcome, task: Task): Promise<Task | null> {
    if (reaction.kind === 'nothing') {
      return null;
    }

    const saying = {
      station: reaction.station,
      body: reaction.body,
      at: this.clock.now(),
      voice: Voice.world(),
      said: reaction.said,
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

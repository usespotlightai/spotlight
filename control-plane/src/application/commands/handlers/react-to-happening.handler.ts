import type { ReactToHappeningCommand } from '@application/commands/react-to-happening.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { StoredDelivery } from '@application/ports/delivery-inbox.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { Happened } from '@application/ports/webhook-source.port';
import type { TaskDispatching } from '@application/services/task-dispatch';
import type { WebhookSources } from '@application/services/webhook-sources.service';
import type { Task } from '@domain/aggregates/task.aggregate';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { Placement } from '@domain/services/placement';
import { type Outcome, ReactionFor } from '@domain/services/reaction-for';
import { Voice } from '@domain/value-objects/voice.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

/**
 * Word came in about a task, and the line said what to do with it. A word
 * about a task nobody here has, or one nowhere waits for, is not an error:
 * the host tells us about everything it knows of.
 */
export class ReactToHappeningHandler
  implements CommandHandlerPort<ReactToHappeningCommand, void>
{
  constructor(
    private readonly sources: WebhookSources,
    private readonly tasks: TaskRepository,
    private readonly lines: AssemblyLineRepository,
    private readonly dispatch: TaskDispatching,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  /**
   * Worked after the host has been answered, so nothing here is racing a
   * timeout. Taking the delivery in is what made it ours, and only once.
   */
  async execute(command: ReactToHappeningCommand): Promise<void> {
    try {
      const stored: StoredDelivery = command.delivered;
      const source = this.sources.find(stored.source);

      if (!source) {
        return;
      }

      const delivered = {
        headers: stored.headers,
        body: stored.body,
        raw: null,
      };

      // What Spotlight itself did is not news to Spotlight.
      const news = source.read(delivered).filter((each) => !each.ourOwn);

      if (news.length === 0) {
        return;
      }

      // Whose word this is, before anything is looked up on it. A host
      // speaking for nobody here reaches no task.
      const workspaceId = await source.routes(delivered);

      if (!workspaceId) {
        return;
      }

      for (const happened of news) {
        await this.transaction.run(() => this.reactTo(workspaceId, happened));
      }
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async reactTo(
    workspaceId: WorkspaceId,
    happened: Happened,
  ): Promise<void> {
    const task = await this.tasks.holding(workspaceId, happened.concerns);
    const line = task && (await this.lines.holding(task.stationId));

    if (!task || !line) {
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

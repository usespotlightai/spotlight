import type { ReactToHappeningCommand } from '@application/commands/react-to-happening.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { DeliveryLogPort } from '@application/ports/delivery-log.port';
import type { RepositoryEventsPort } from '@application/ports/repository-events.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { TaskDispatching } from '@application/services/task-dispatch';
import type { Task } from '@domain/aggregates/task.aggregate';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { Placement } from '@domain/services/placement';
import { type Reaction, ReactionFor } from '@domain/services/reaction-for';
import type { Concerns } from '@domain/value-objects/concerns.vo';

/**
 * Word came in about a task, and the line said what to do with it. A word
 * about a task nobody here has, or one nowhere waits for, is not an error:
 * the host tells us about the whole repository.
 */
export class ReactToHappeningHandler
  implements CommandHandlerPort<ReactToHappeningCommand, void>
{
  constructor(
    private readonly events: RepositoryEventsPort,
    private readonly deliveries: DeliveryLogPort,
    private readonly tasks: TaskRepository,
    private readonly lines: AssemblyLineRepository,
    private readonly dispatch: TaskDispatching,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: ReactToHappeningCommand): Promise<void> {
    try {
      await this.transaction.run(async () => {
        const happened = this.events.read(command.event, command.payload);

        // What Spotlight itself did is not news to Spotlight, and a word we
        // have already acted on is not news either.
        if (
          !happened ||
          happened.ourOwn ||
          !(await this.deliveries.claim(command.delivery))
        ) {
          return;
        }

        const task = await this.concerned(happened.concerns);
        const line = task && (await this.lines.holding(task.stationId));

        if (!task || !line) {
          return;
        }

        const reaction = ReactionFor.happened({
          task,
          line,
          happening: happened.happening,
          said: happened.said,
        });

        const heard = await this.applied(reaction, task);

        if (!heard) {
          return;
        }

        // Asked of the task rather than assumed: work owed to a person is
        // not work to start, however loudly the world knocks.
        const runId = heard.idle
          ? await this.dispatch.dispatch({ task: heard, line })
          : null;

        await this.tasks.save(runId ? heard.handedTo(runId) : heard);
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async applied(reaction: Reaction, task: Task): Promise<Task | null> {
    if (reaction.kind === 'nothing') {
      return null;
    }

    const saying = {
      station: reaction.station,
      body: reaction.body,
      at: this.clock.now(),
    };

    if (reaction.kind === 'stays') {
      return task.heard(saying);
    }

    return task.moveTo(
      reaction.to,
      Placement.atTheTop(await this.tasks.placementsAt(reaction.to.id)),
      saying,
    );
  }

  private async concerned(concerns: Concerns): Promise<Task | null> {
    return concerns.taskId
      ? this.tasks.find(concerns.taskId)
      : concerns.pullRequest
        ? this.tasks.withPullRequest(concerns.pullRequest)
        : null;
  }
}

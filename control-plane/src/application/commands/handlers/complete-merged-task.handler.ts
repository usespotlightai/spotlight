import type { CompleteMergedTaskCommand } from '@application/commands/complete-merged-task.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { Placement } from '@domain/services/placement';
import { PullRequestUrl } from '@domain/value-objects/pull-request-url.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';

/**
 * The pull request was merged, so the task lands at the end of its line.
 * A merge Spotlight knows nothing about is not an error: GitHub tells us
 * about every pull request on the repository, most of them nobody's here.
 */
export class CompleteMergedTaskHandler
  implements CommandHandlerPort<CompleteMergedTaskCommand, void>
{
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: AssemblyLineRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: CompleteMergedTaskCommand): Promise<void> {
    try {
      await this.transaction.run(async () => {
        const task = await this.tasks.withPullRequest(
          PullRequestUrl.of(command.pullRequestUrl),
        );

        if (!task) {
          return;
        }

        const line = await this.lines.holding(task.stationId);

        if (!line) {
          return;
        }

        const completed = line.completed;

        await this.tasks.save(
          task.merged(
            completed,
            Placement.atTheTop(await this.tasks.placementsAt(completed.id)),
            {
              station: line.stationAt(task.stationId)?.name ?? completed.name,
              body: TaskNoteBody.merged(),
              at: this.clock.now(),
            },
          ),
        );
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

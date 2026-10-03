import type { RecordSearchCauseCommand } from '@replays/application/commands/record-search-cause.command';
import type { SearchCauseRecorded } from '@replays/application/dto/replay-outcomes.dto';
import type { WorkPort } from '@replays/application/ports/work.port';
import { SearchRunNotHeldError } from '@replays/domain/exceptions/search-run-not-held.error';
import { UnknownSearchTaskError } from '@replays/domain/exceptions/unknown-search-task.error';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

const taskOf = (held: unknown): TaskId => {
  const said = typeof held === 'string' ? held.trim() : '';

  if (!said) {
    throw new UnknownSearchTaskError(String(held ?? ''));
  }

  return TaskId.of(said);
};

export class RecordSearchCauseHandler
  implements CommandHandlerPort<RecordSearchCauseCommand, SearchCauseRecorded>
{
  constructor(
    private readonly work: WorkPort,
    private readonly searches: SearchRepository,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: RecordSearchCauseCommand,
  ): Promise<SearchCauseRecorded> {
    try {
      const run = RunId.of(command.runId);
      const held = await this.work.heldSearchRun(run, command.runnerId);

      if (!held) {
        throw new SearchRunNotHeldError();
      }

      const taskId = taskOf(command.taskId);

      return await this.transaction.run(async () => {
        const search = await this.searches.locked(held.searchId);

        if (!search) {
          throw new SearchRunNotHeldError();
        }

        const recorded = search.causeRecorded(
          run,
          {
            taskId,
            cause: command.cause,
            evidence: command.evidence,
            suggestion: command.suggestion,
          },
          this.clock.now(),
        );
        const cause = recorded
          .iterationOf(run)
          ?.causes.find((each) => each.isAbout(taskId));

        if (!cause) {
          throw new UnknownSearchTaskError(taskId.value);
        }

        await this.searches.save(recorded);

        return {
          taskId: cause.taskId.value,
          cause: cause.cause,
          replayRunId: cause.replayRunId.value,
        };
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

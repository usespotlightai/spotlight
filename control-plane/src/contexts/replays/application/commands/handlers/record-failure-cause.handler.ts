import type { RecordFailureCauseCommand } from '@replays/application/commands/record-failure-cause.command';
import type { FailureCauseRecorded } from '@replays/application/dto/replay-outcomes.dto';
import type { SearchRunDispatching } from '@replays/application/services/search-run-dispatch.service';
import { SearchRunNotActiveError } from '@replays/domain/exceptions/search-run-not-active.error';
import { UnknownSearchTaskError } from '@replays/domain/exceptions/unknown-search-task.error';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

const shownAs = (raw: unknown): string => {
  if (raw === undefined || raw === null) {
    return '';
  }

  return typeof raw === 'string' ? raw : JSON.stringify(raw);
};

const taskOf = (raw: unknown): TaskId => {
  const id = typeof raw === 'string' ? raw.trim() : '';

  if (!id) {
    throw new UnknownSearchTaskError(shownAs(raw));
  }

  return TaskId.of(id);
};

export class RecordFailureCauseHandler implements CommandHandlerPort<
  RecordFailureCauseCommand,
  FailureCauseRecorded
> {
  constructor(
    private readonly searchRuns: SearchRunDispatching,
    private readonly searches: SearchRepository,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: RecordFailureCauseCommand,
  ): Promise<FailureCauseRecorded> {
    try {
      const run = RunId.of(command.runId);
      const leased = await this.searchRuns.leasedSearchRun(
        run,
        command.runnerId,
      );

      if (!leased) {
        throw new SearchRunNotActiveError();
      }

      const taskId = taskOf(command.taskId);

      return await this.transaction.inTransaction(async () => {
        const search = await this.searches.locked(leased.searchId);

        if (!search) {
          throw new SearchRunNotActiveError();
        }

        const recorded = search.recordCause(
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
      rethrowAsApplicationError(error);
    }
  }
}

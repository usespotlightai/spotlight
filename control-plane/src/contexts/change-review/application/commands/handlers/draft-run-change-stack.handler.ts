import type { DraftRunChangeStackCommand } from '@change-review/application/commands/draft-run-change-stack.command';
import type { WorkPort } from '@change-review/application/ports/work.port';
import type { DraftChangeStack } from '@change-review/application/services/draft-change-stack.service';
import { UnknownChangeStackError } from '@change-review/domain/exceptions/unknown-change-stack.error';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class DraftRunChangeStackHandler
  implements CommandHandlerPort<DraftRunChangeStackCommand, void>
{
  constructor(
    private readonly work: WorkPort,
    private readonly drafting: DraftChangeStack,
  ) {}

  async execute(command: DraftRunChangeStackCommand): Promise<void> {
    try {
      const runId = RunId.of(command.runId);

      if (
        !(await this.work.wasWorkedBy(runId, RunnerId.of(command.runnerId)))
      ) {
        throw new UnknownChangeStackError(
          `there is no run ${command.runId} this runner worked`,
        );
      }

      const run = await this.work.run(runId);

      if (!run) {
        throw new UnknownChangeStackError(`there is no run ${command.runId}`);
      }

      await this.drafting.begin(
        { id: run.id, taskId: run.taskId, workspaceId: run.workspaceId },
        {
          diff: command.diff,
          repository: command.repository,
          base: command.base,
          request: run.checking
            ? CheckRequest.of(
                run.checking.command,
                run.checking.setups.get(command.repository ?? '') ?? null,
                run.checking.placement,
              )
            : null,
        },
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

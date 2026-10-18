import type { GenerateRunChangeStackCommand } from '@change-review/application/commands/generate-run-change-stack.command';
import type { WorkPort } from '@change-review/application/ports/work.port';
import type { GenerateChangeStack } from '@change-review/application/services/generate-change-stack.service';
import { UnknownChangeStackError } from '@change-review/domain/exceptions/unknown-change-stack.error';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class GenerateRunChangeStackHandler
  implements CommandHandlerPort<GenerateRunChangeStackCommand, void>
{
  constructor(
    private readonly work: WorkPort,
    private readonly generating: GenerateChangeStack,
  ) {}

  async execute(command: GenerateRunChangeStackCommand): Promise<void> {
    try {
      const runId = RunId.of(command.runId);

      if (
        !(await this.work.wasClaimedBy(runId, RunnerId.of(command.runnerId)))
      ) {
        throw new UnknownChangeStackError(
          `This runner didn’t work run ${command.runId}.`,
        );
      }

      const run = await this.work.run(runId);

      if (!run) {
        throw new UnknownChangeStackError(`Run ${command.runId} not found.`);
      }

      await this.generating.begin(
        {
          id: run.id,
          taskId: run.taskId,
          isReplay: run.isReplay,
          isSearch: run.isSearch,
          workspaceId: run.workspaceId,
        },
        {
          diff: command.diff,
          repository: command.repository,
          base: command.base,
          request: CheckRequest.forRepository(run.checking, command.repository),
        },
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

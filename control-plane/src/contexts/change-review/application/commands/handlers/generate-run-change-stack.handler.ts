import type { GenerateRunChangeStackCommand } from '@change-review/application/commands/generate-run-change-stack.command';
import type { WorkPort } from '@change-review/application/ports/work.port';
import type { GenerateChangeStack } from '@change-review/application/services/generate-change-stack.service';
import { NoStackWithoutCheckoutsError } from '@change-review/domain/exceptions/no-stack-without-checkouts.error';
import { UnknownChangeStackError } from '@change-review/domain/exceptions/unknown-change-stack.error';
import { lineRepositoryOf } from '@change-review/domain/services/line-repository';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { StackOrigin } from '@change-review/domain/value-objects/stack-origin.vo';
import type { RunLeasesPort } from '@runs/application/ports/run-leases.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class GenerateRunChangeStackHandler implements CommandHandlerPort<
  GenerateRunChangeStackCommand,
  void
> {
  constructor(
    private readonly work: WorkPort,
    private readonly leases: RunLeasesPort,
    private readonly generating: GenerateChangeStack,
  ) {}

  async execute(command: GenerateRunChangeStackCommand): Promise<void> {
    try {
      const runId = RunId.of(command.runId);

      if (
        !(await this.leases.claimedBy(runId, RunnerId.of(command.runnerId)))
      ) {
        throw new UnknownChangeStackError(
          `This runner didn’t work run ${command.runId}.`,
        );
      }

      const run = await this.work.run(runId);

      if (!run) {
        throw new UnknownChangeStackError(`Run ${command.runId} not found.`);
      }

      if (run.checkouts === 0) {
        throw new NoStackWithoutCheckoutsError();
      }

      const repository = lineRepositoryOf(
        await this.work.repositoriesOfRun(runId),
        command.repository,
      );

      await this.generating.begin(
        {
          origin: StackOrigin.run(run.id),
          taskId: run.taskId,
          teamOfRun: run.taskId ? null : await this.work.teamOfRun(runId),
          trial: run.trial,
          checkouts: run.checkouts,
          workspaceId: run.workspaceId,
        },
        {
          diff: command.diff,
          owner: repository.owner,
          repository: repository.name,
          base: command.base,
          request: CheckRequest.forRepository(run.checking, command.repository),
        },
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

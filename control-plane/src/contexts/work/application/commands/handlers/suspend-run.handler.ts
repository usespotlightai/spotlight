import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { SuspendRunCommand } from '@work/application/commands/runner.commands';
import type { RunSuspensionDto } from '@work/application/dto/run-completion.dto';
import { RunVersionConflictError } from '@work/domain/exceptions/run-version-conflict.error';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';

const ATTEMPTS = 3;

export class SuspendRunHandler
  implements CommandHandlerPort<SuspendRunCommand, RunSuspensionDto>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: SuspendRunCommand): Promise<RunSuspensionDto> {
    try {
      const runner = RunnerId.of(command.runnerId);

      for (let attempt = 1; ; attempt++) {
        try {
          return await this.transaction.inTransaction(() =>
            this.suspend(RunId.of(command.runId), runner, command.requeue),
          );
        } catch (error) {
          if (
            !(error instanceof RunVersionConflictError) ||
            attempt >= ATTEMPTS
          ) {
            throw error;
          }
        }
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async suspend(
    runId: RunId,
    runner: RunnerId,
    requeue: boolean,
  ): Promise<RunSuspensionDto> {
    const run = await this.runs.findById(runId);

    if (!run) {
      throw new UnknownRunError(`Run ${runId.value} not found.`);
    }

    const suspended = run.suspend(runner, this.clock.now(), requeue);

    if (suspended !== run) {
      await this.runs.save(suspended);
    }

    return { suspended: !suspended.isLeasedBy(runner) };
  }
}

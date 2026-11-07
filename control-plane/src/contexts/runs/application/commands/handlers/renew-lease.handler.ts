import type { RunnerClaimantsPort } from '@runners/application/ports/runner-claimants.port';
import type { RenewLeaseCommand } from '@runs/application/commands/runner.commands';
import { Run } from '@runs/domain/aggregates/run.aggregate';
import { RunVersionConflictError } from '@runs/domain/exceptions/run-version-conflict.error';
import { UnknownRunError } from '@runs/domain/exceptions/unknown-run.error';
import { UnknownRunnerError } from '@runs/domain/exceptions/unknown-runner.error';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

const ATTEMPTS = 3;

export class RenewLeaseHandler
  implements CommandHandlerPort<RenewLeaseCommand, void>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly claimants: RunnerClaimantsPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RenewLeaseCommand): Promise<void> {
    try {
      const renewing = RunnerId.of(command.runnerId);
      const at = this.clock.now();

      if (!(await this.claimants.claimantOf(renewing, at))) {
        throw new UnknownRunnerError(command.runnerId);
      }

      for (let attempt = 1; ; attempt++) {
        const run = await this.load(command.runId);

        if (!run.isLeasedBy(renewing)) {
          throw new UnknownRunError(
            `Runner ${command.runnerId} has no lease on run ${command.runId}.`,
          );
        }

        try {
          await this.runs.save(run.renewLease(renewing, at));
          return;
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

  private async load(id: string): Promise<Run> {
    const found = await this.runs.findById(RunId.of(id));
    if (!found) {
      throw new UnknownRunError(`Run ${id} not found.`);
    }
    return found;
  }
}

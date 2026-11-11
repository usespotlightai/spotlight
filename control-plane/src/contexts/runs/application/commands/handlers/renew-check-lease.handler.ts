import type { RunnerClaimantsPort } from '@runners/application/ports/runner-claimants.port';
import type { RenewCheckLeaseCommand } from '@runs/application/commands/runner.commands';
import type {
  CheckLeaseRenewal,
  CheckWorkPort,
} from '@runs/application/ports/check-work.port';
import { UnknownRunnerError } from '@runs/domain/exceptions/unknown-runner.error';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { CheckWorkId } from '@shared-kernel/domain/value-objects/check-work-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class RenewCheckLeaseHandler implements CommandHandlerPort<
  RenewCheckLeaseCommand,
  CheckLeaseRenewal
> {
  constructor(
    private readonly checks: CheckWorkPort,
    private readonly claimants: RunnerClaimantsPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RenewCheckLeaseCommand): Promise<CheckLeaseRenewal> {
    try {
      const renewing = RunnerId.of(command.runnerId);
      const at = this.clock.now();

      if (!(await this.claimants.claimantOf(renewing, at))) {
        throw new UnknownRunnerError(command.runnerId);
      }

      return await this.checks.renewLease(
        RunId.of(command.runId),
        CheckWorkId.of(command.checkId),
        command.repeat,
        renewing,
        at,
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

import type { RunnerPresencePort } from '@runners/application/ports/runner-presence.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RenewCheckLeaseCommand } from '@work/application/commands/runner.commands';
import type {
  CheckLeaseRenewal,
  CheckWorkPort,
} from '@work/application/ports/check-work.port';
import { UnknownRunnerError } from '@work/domain/exceptions/unknown-runner.error';

export class RenewCheckLeaseHandler
  implements CommandHandlerPort<RenewCheckLeaseCommand, CheckLeaseRenewal>
{
  constructor(
    private readonly checks: CheckWorkPort,
    private readonly presence: RunnerPresencePort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RenewCheckLeaseCommand): Promise<CheckLeaseRenewal> {
    try {
      const renewing = RunnerId.of(command.runnerId);
      const at = this.clock.now();

      if (!(await this.presence.seen(renewing, at))) {
        throw new UnknownRunnerError(command.runnerId);
      }

      return await this.checks.renewLease(
        RunId.of(command.runId),
        command.stackId,
        renewing,
        at,
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

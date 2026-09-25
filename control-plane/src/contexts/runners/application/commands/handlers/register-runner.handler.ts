import { type RegisterRunnerCommand } from '@runners/application/commands/runner-fleet.commands';
import { type RegisteredRunnerDto } from '@runners/application/dto/runner.dto';
import { revisePoolRunner } from '@runners/application/services/pool-runner-revisions';
import { reviseRunner } from '@runners/application/services/runner-revisions';
import { UnknownRunnerError } from '@runners/domain/exceptions/unknown-runner.error';
import type { PoolRunnerRepository } from '@runners/domain/repositories/pool-runner.repository';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class RegisterRunnerHandler
  implements CommandHandlerPort<RegisterRunnerCommand, RegisteredRunnerDto>
{
  constructor(
    private readonly runners: RunnerRepository,
    private readonly pooled: PoolRunnerRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RegisterRunnerCommand): Promise<RegisteredRunnerDto> {
    try {
      const installed = command.harnesses.map((each) =>
        InstalledHarness.reported(each.id, each.models, each.version),
      );

      const runnerId = RunnerId.of(command.runnerId);
      const registered =
        (await reviseRunner(this.runners, runnerId, (runner) =>
          runner.register(installed, this.clock.now()),
        )) ??
        (await revisePoolRunner(this.pooled, runnerId, (runner) =>
          runner.register(installed, this.clock.now()),
        ));

      if (!registered) {
        throw new UnknownRunnerError(command.runnerId);
      }

      return { runnerId: registered.id.value };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

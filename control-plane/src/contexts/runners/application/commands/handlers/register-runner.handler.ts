import { type RegisterRunnerCommand } from '@runners/application/commands/runner-fleet.commands';
import { type RegisteredRunnerDto } from '@runners/application/dto/runner.dto';
import { reviseRunner } from '@runners/application/services/runner-revisions';
import { UnknownRunnerError } from '@runners/domain/exceptions/unknown-runner.error';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class RegisterRunnerHandler
  implements CommandHandlerPort<RegisterRunnerCommand, RegisteredRunnerDto>
{
  constructor(
    private readonly runners: RunnerRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RegisterRunnerCommand): Promise<RegisteredRunnerDto> {
    try {
      const installed = command.harnesses.map((each) =>
        InstalledHarness.reported(each.id, each.models, each.version),
      );

      const registered = await reviseRunner(
        this.runners,
        RunnerId.of(command.runnerId),
        (runner) => runner.register(installed, this.clock.now()),
      );

      if (!registered) {
        throw new UnknownRunnerError(command.runnerId);
      }

      return { runnerId: registered.id.value };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

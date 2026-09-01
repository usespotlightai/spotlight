import type { RegisterRunnerCommand } from '@application/commands/runner.commands';
import type { RegisteredRunnerDto } from '@application/dto/run.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import { UnknownRunError } from '@domain/exceptions/unknown-run.error';
import type { RunnerRepository } from '@domain/repositories/runner.repository';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';

/**
 * A runner checking in. Its identity comes from the token it presented, so a
 * restart lands on the record it already had instead of making another one.
 */
export class RegisterRunnerHandler
  implements CommandHandlerPort<RegisterRunnerCommand, RegisteredRunnerDto>
{
  constructor(
    private readonly runners: RunnerRepository,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: RegisterRunnerCommand): Promise<RegisteredRunnerDto> {
    try {
      const id = RunnerId.of(command.runnerId);

      const registering = await this.runners.find(id);
      if (!registering) {
        throw new UnknownRunError(`runner ${command.runnerId} is not enrolled`);
      }

      const found = command.harnesses.map(HarnessId.of);

      await this.transaction.run(async () => {
        await this.runners.save(
          registering.reports(found).seen(this.clock.now()),
        );
      });

      return { runnerId: registering.id.value };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

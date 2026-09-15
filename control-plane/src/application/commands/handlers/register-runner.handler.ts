import type { RegisterRunnerCommand } from '@application/commands/runner.commands';
import type { RegisteredRunnerDto } from '@application/dto/run.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { RunnerReaderPort } from '@application/ports/runner-reader.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { SettleSetup } from '@application/services/settle-setup.service';
import type { InstalledHarness } from '@domain/aggregates/runner.aggregate';
import { UnknownRunError } from '@domain/exceptions/unknown-run.error';
import type { RunnerRepository } from '@domain/repositories/runner.repository';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { HarnessModel } from '@domain/value-objects/harness-model.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';

const modelsOf = (ids: readonly string[]): HarnessModel[] =>
  ids.flatMap((id) => {
    try {
      return [HarnessModel.of(id)];
    } catch {
      return [];
    }
  });

export class RegisterRunnerHandler
  implements CommandHandlerPort<RegisterRunnerCommand, RegisteredRunnerDto>
{
  constructor(
    private readonly runners: RunnerRepository,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
    private readonly enrolled: RunnerReaderPort,
    private readonly settling: SettleSetup,
  ) {}

  async execute(command: RegisterRunnerCommand): Promise<RegisteredRunnerDto> {
    try {
      const id = RunnerId.of(command.runnerId);

      const registering = await this.runners.find(id);
      if (!registering) {
        throw new UnknownRunError(`runner ${command.runnerId} is not enrolled`);
      }

      const installed: InstalledHarness[] = command.harnesses.map((each) => ({
        id: HarnessId.of(each.id),
        models: modelsOf(each.models),
      }));

      const wasNone = !(await this.enrolled.anyConnected());

      await this.transaction.run(async () => {
        await this.runners.save(
          registering.reports(installed).seen(this.clock.now()),
        );
      });

      if (wasNone) {
        void this.settling.wherever();
      }

      return { runnerId: registering.id.value };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

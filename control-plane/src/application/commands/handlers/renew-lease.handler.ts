import type { RenewLeaseCommand } from '@application/commands/runner.commands';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import { Run } from '@domain/aggregates/run.aggregate';
import { UnknownRunError } from '@domain/exceptions/unknown-run.error';
import type { RunRepository } from '@domain/repositories/run.repository';
import type { RunnerRepository } from '@domain/repositories/runner.repository';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';

export class RenewLeaseHandler
  implements CommandHandlerPort<RenewLeaseCommand, void>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly runners: RunnerRepository,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: RenewLeaseCommand): Promise<void> {
    try {
      const renewing = RunnerId.of(command.runnerId);
      const at = this.clock.now();

      const holder = await this.runners.find(renewing);
      if (!holder) {
        throw new UnknownRunError(`runner ${command.runnerId} is not enrolled`);
      }

      const renewed = (await this.load(command.runId)).renewLease(renewing, at);

      await this.transaction.run(async () => {
        await this.runs.save(renewed);
        await this.runners.save(holder.seen(at));
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async load(id: string): Promise<Run> {
    const found = await this.runs.findById(RunId.of(id));
    if (!found) {
      throw new UnknownRunError(`there is no run ${id}`);
    }
    return found;
  }
}

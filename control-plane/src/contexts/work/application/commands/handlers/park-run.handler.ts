import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { ParkRunCommand } from '@work/application/commands/runner.commands';
import type { RunParkingDto } from '@work/application/dto/run-completion.dto';
import { RunMovedOnError } from '@work/domain/exceptions/run-moved-on.error';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';

const ATTEMPTS = 3;

export class ParkRunHandler
  implements CommandHandlerPort<ParkRunCommand, RunParkingDto>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: ParkRunCommand): Promise<RunParkingDto> {
    try {
      const runner = RunnerId.of(command.runnerId);

      for (let attempt = 1; ; attempt++) {
        try {
          return await this.transaction.run(() =>
            this.parked(RunId.of(command.runId), runner, command.cold),
          );
        } catch (error) {
          if (!(error instanceof RunMovedOnError) || attempt >= ATTEMPTS) {
            throw error;
          }
        }
      }
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async parked(
    runId: RunId,
    runner: RunnerId,
    cold: boolean,
  ): Promise<RunParkingDto> {
    const run = await this.runs.findById(runId);

    if (!run) {
      throw new UnknownRunError(`Run ${runId.value} not found.`);
    }

    const parked = run.park(runner, this.clock.now(), cold);

    if (parked !== run) {
      await this.runs.save(parked);
    }

    return { parked: !parked.isHeldBy(runner) };
  }
}

import type { RunnerPresencePort } from '@runners/application/ports/runner-presence.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { RenewLeaseCommand } from '@work/application/commands/runner.commands';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { RunMovedOnError } from '@work/domain/exceptions/run-moved-on.error';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import { UnknownRunnerError } from '@work/domain/exceptions/unknown-runner.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';

const ATTEMPTS = 3;

export class RenewLeaseHandler
  implements CommandHandlerPort<RenewLeaseCommand, void>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly presence: RunnerPresencePort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RenewLeaseCommand): Promise<void> {
    try {
      const renewing = RunnerId.of(command.runnerId);
      const at = this.clock.now();

      if (!(await this.presence.seen(renewing, at))) {
        throw new UnknownRunnerError(command.runnerId);
      }

      for (let attempt = 1; ; attempt++) {
        const run = await this.load(command.runId);

        if (!run.isHeldBy(renewing)) {
          throw new UnknownRunError(
            `Runner ${command.runnerId} holds no run ${command.runId}.`,
          );
        }

        try {
          await this.runs.save(run.renewLease(renewing, at));
          return;
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

  private async load(id: string): Promise<Run> {
    const found = await this.runs.findById(RunId.of(id));
    if (!found) {
      throw new UnknownRunError(`Run ${id} not found.`);
    }
    return found;
  }
}

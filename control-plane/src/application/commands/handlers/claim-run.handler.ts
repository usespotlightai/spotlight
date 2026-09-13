import type { ClaimRunCommand } from '@application/commands/runner.commands';
import type { ClaimedRunDto } from '@application/dto/run.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import { UnknownRunError } from '@domain/exceptions/unknown-run.error';
import type { RunRepository } from '@domain/repositories/run.repository';
import type { RunnerRepository } from '@domain/repositories/runner.repository';
import { RunnerId } from '@domain/value-objects/runner-id.vo';

const POLL_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 500;

export class ClaimRunHandler
  implements CommandHandlerPort<ClaimRunCommand, ClaimedRunDto | null>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly runners: RunnerRepository,
    private readonly clock: ClockPort,
    private readonly events: DomainEventDispatcher,
  ) {}

  async execute(command: ClaimRunCommand): Promise<ClaimedRunDto | null> {
    try {
      const runnerId = RunnerId.of(command.runnerId);

      const asking = await this.runners.find(runnerId);
      if (!asking) {
        throw new UnknownRunError(
          `runner ${command.runnerId} is not registered`,
        );
      }

      await this.runners.save(asking.seen(this.clock.now()));

      const givenUp = await this.runs.requeueLapsed(this.clock.now());

      await this.events.dispatch(
        givenUp.flatMap((run) => [...run.pullEvents()]),
      );

      const deadline = this.clock.now().getTime() + POLL_TIMEOUT_MS;

      for (;;) {
        const claimed = await this.runs.claimNext(
          asking.harnesses,
          runnerId,
          this.clock.now(),
        );

        if (claimed) {
          return {
            id: claimed.id.value,
            spec: claimed.spec.value,
          };
        }

        if (this.clock.now().getTime() >= deadline) {
          return null;
        }

        await this.clock.sleep(POLL_INTERVAL_MS);
      }
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

import type { ClaimRunCommand } from '@application/commands/runner.commands';
import type { ClaimedRunDto } from '@application/dto/run.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { RunOutcomes } from '@application/services/run-outcomes';
import { Run } from '@domain/aggregates/run.aggregate';
import { RunCompleted } from '@domain/events/run-completed.event';
import { UnknownRunError } from '@domain/exceptions/unknown-run.error';
import type { RunRepository } from '@domain/repositories/run.repository';
import type { RunnerRepository } from '@domain/repositories/runner.repository';
import { RunnerId } from '@domain/value-objects/runner-id.vo';

const announce = async (ended: Run, to: RunOutcomes): Promise<void> => {
  for (const raised of ended.happened) {
    if (raised instanceof RunCompleted) {
      await to.onRunCompleted(raised);
    } else {
      await to.onRunAbandoned(raised);
    }
  }
};

/**
 * How long a claim is held open before answering empty. The runner polls in a
 * tight loop, so holding the request here is what keeps it off the database.
 */
const POLL_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 500;

export class ClaimRunHandler
  implements CommandHandlerPort<ClaimRunCommand, ClaimedRunDto | null>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly runners: RunnerRepository,
    private readonly clock: ClockPort,
    private readonly handover: RunOutcomes,
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

      // The poll doubles as the heartbeat. A runner that stops asking stops
      // being counted on.
      await this.runners.save(asking.seen(this.clock.now()));

      // Once per claim, not per attempt. A runner whose host died leaves a run
      // held until its lease lapses, and somebody has to notice.
      for (const abandoned of await this.runs.requeueLapsed(this.clock.now())) {
        await announce(abandoned, this.handover);
      }

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
            leaseExpiresAt: (
              claimed.leaseExpiresAt ?? this.clock.now()
            ).toISOString(),
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

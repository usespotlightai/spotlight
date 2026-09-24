import type { RunnerPresencePort } from '@runners/application/ports/runner-presence.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { ClaimRunCommand } from '@work/application/commands/runner.commands';
import { RunSpecContract } from '@work/application/contracts/run-spec.contract';
import type { ClaimedWorkDto } from '@work/application/dto/run.dto';
import type { CheckWorkPort } from '@work/application/ports/check-work.port';
import type { RunLeases } from '@work/application/services/run-leases.service';
import { UnknownRunError } from '@work/domain/exceptions/unknown-run.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';

const POLL_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 500;

export class ClaimRunHandler
  implements CommandHandlerPort<ClaimRunCommand, ClaimedWorkDto | null>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly leases: RunLeases,
    private readonly presence: RunnerPresencePort,
    private readonly clock: ClockPort,
    private readonly checks: CheckWorkPort,
  ) {}

  async execute(command: ClaimRunCommand): Promise<ClaimedWorkDto | null> {
    try {
      const runnerId = RunnerId.of(command.runnerId);

      const seen = await this.presence.seen(runnerId, this.clock.now());
      if (!seen) {
        throw new UnknownRunError(
          `runner ${command.runnerId} is not registered`,
        );
      }

      await this.leases.requeueLapsed(this.clock.now());

      const deadline = this.clock.now().getTime() + POLL_TIMEOUT_MS;

      for (;;) {
        const claimed = await this.runs.claimNext(
          {
            runner: runnerId,
            workspaceId: seen.workspaceId,
            harnesses: seen.harnesses,
            terms: seen.terms,
          },
          this.clock.now(),
        );

        if (claimed) {
          return {
            kind: 'run',
            run: {
              id: claimed.id.value,
              spec: RunSpecContract.toWire(claimed.spec),
            },
          };
        }

        const check = await this.checks.claimNext(
          seen.workspaceId,
          runnerId,
          seen.terms,
          this.clock.now(),
        );

        if (check) {
          return { kind: 'check', check };
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

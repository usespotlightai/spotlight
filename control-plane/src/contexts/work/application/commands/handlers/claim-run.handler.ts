import type { RunnerPresencePort } from '@runners/application/ports/runner-presence.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { ClaimRunCommand } from '@work/application/commands/runner.commands';
import type { ClaimedWorkDto } from '@work/application/dto/run.dto';
import type { CheckWorkPort } from '@work/application/ports/check-work.port';
import { claimedRun } from '@work/application/services/claimed-work';
import type { ClaimsTaken } from '@work/application/services/claims-taken.service';
import { longPolled, pollDeadline } from '@work/application/services/long-poll';
import type { ProvisionFailures } from '@work/application/services/provision-failures.service';
import type { RunLeases } from '@work/application/services/run-leases.service';
import type { RunStartHooks } from '@work/application/services/run-start-hooks.service';
import { UnknownRunnerError } from '@work/domain/exceptions/unknown-runner.error';
import type {
  Claimant,
  RunRepository,
} from '@work/domain/repositories/run.repository';

export class ClaimRunHandler
  implements CommandHandlerPort<ClaimRunCommand, ClaimedWorkDto | null>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly leases: RunLeases,
    private readonly presence: RunnerPresencePort,
    private readonly clock: ClockPort,
    private readonly checks: CheckWorkPort,
    private readonly taken: ClaimsTaken,
    private readonly failures: ProvisionFailures,
    private readonly starting: RunStartHooks,
  ) {}

  async execute(command: ClaimRunCommand): Promise<ClaimedWorkDto | null> {
    try {
      const runnerId = RunnerId.of(command.runnerId);

      const seen = await this.presence.seen(runnerId, this.clock.now());
      if (!seen) {
        throw new UnknownRunnerError(command.runnerId);
      }

      if (seen.claims === 'nothing') {
        return null;
      }

      await this.leases.requeueLapsed(this.clock.now());

      const claimant: Claimant = {
        runner: runnerId,
        workspaceId: seen.workspaceId,
        harnesses: seen.harnesses,
        terms: seen.terms,
        claims: seen.claims,
      };

      return await this.reserved(claimant);
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async reserved(claimant: Claimant): Promise<ClaimedWorkDto | null> {
    const waiting = await this.runs.waitingFor(claimant.runner);
    const refusal = waiting?.provisionRefusedBy(
      claimant.runner,
      claimant.harnesses,
    );

    if (waiting && refusal) {
      await this.failures.failed(
        waiting.id,
        claimant.runner,
        refusal,
        this.clock.now(),
      );

      return null;
    }

    const until = pollDeadline(this.clock);

    const found = await longPolled<ClaimedWorkDto | 'handed-back'>(
      this.clock,
      async () => {
        const claimed = await this.runs.claimNext(claimant, this.clock.now());
        const start = claimed
          ? await this.starting.mayStart(claimed, claimant.runner, until)
          : null;

        if (start === 'handed-back') {
          return start;
        }

        if (claimed && start === 'starts') {
          await this.taken.run(claimed, claimant.runner);

          return claimedRun(claimed);
        }

        const check = await this.checks.claimReserved(
          claimant.runner,
          claimant.terms,
          this.clock.now(),
        );

        if (!check) {
          return null;
        }

        await this.taken.check(check, claimant.runner);

        return { kind: 'check', check };
      },
      until,
    );

    return found === 'handed-back' ? null : found;
  }
}

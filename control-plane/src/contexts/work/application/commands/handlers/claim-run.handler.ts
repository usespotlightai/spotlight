import type { RunnerHeartbeatsPort } from '@runners/application/ports/runner-heartbeats.port';
import type { SandboxesPort } from '@runners/application/ports/sandboxes.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { ClaimRunCommand } from '@work/application/commands/runner.commands';
import type { ClaimedWorkDto } from '@work/application/dto/run.dto';
import type { CheckWorkPort } from '@work/application/ports/check-work.port';
import { claimedRun } from '@work/application/services/claimed-work';
import type { ClaimsTaken } from '@work/application/services/claims-taken.service';
import type { LongPoll } from '@work/application/services/long-poll';
import type { ProvisionFailures } from '@work/application/services/provision-failures.service';
import type { RunLeases } from '@work/application/services/run-leases.service';
import type { RunStartHooks } from '@work/application/services/run-start-hooks.service';
import { UnknownRunnerError } from '@work/domain/exceptions/unknown-runner.error';
import type {
  Claimant,
  RunRepository,
} from '@work/domain/repositories/run.repository';
import { ResumeKey } from '@work/domain/value-objects/resume-key.vo';

export class ClaimRunHandler
  implements CommandHandlerPort<ClaimRunCommand, ClaimedWorkDto | null>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly leases: RunLeases,
    private readonly heartbeats: RunnerHeartbeatsPort,
    private readonly clock: ClockPort,
    private readonly checks: CheckWorkPort,
    private readonly taken: ClaimsTaken,
    private readonly failures: ProvisionFailures,
    private readonly starting: RunStartHooks,
    private readonly polls: LongPoll,
    private readonly sandboxes: SandboxesPort,
  ) {}

  async execute(command: ClaimRunCommand): Promise<ClaimedWorkDto | null> {
    try {
      const runnerId = RunnerId.of(command.runnerId);

      const heartbeat = await this.heartbeats.heartbeat(
        runnerId,
        this.clock.now(),
      );
      if (!heartbeat) {
        throw new UnknownRunnerError(command.runnerId);
      }

      if (heartbeat.claims === 'nothing') {
        return null;
      }

      await this.leases.expireLeases(this.clock.now());

      const claimant: Claimant = {
        runner: runnerId,
        workspaceId: heartbeat.workspaceId,
        harnesses: heartbeat.harnesses,
        offer: heartbeat.offer,
        claims: heartbeat.claims,
      };

      return await this.reserved(claimant);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async reserved(claimant: Claimant): Promise<ClaimedWorkDto | null> {
    const reservedRun = await this.runs.reservedFor(claimant.runner);
    const failure = reservedRun?.provisionFailureFor(
      claimant.runner,
      claimant.harnesses,
    );

    if (reservedRun && failure) {
      await this.failures.failed(
        reservedRun.id,
        claimant.runner,
        failure,
        this.clock.now(),
      );

      return null;
    }

    const until = this.polls.deadline();

    const found = await this.polls.polled<ClaimedWorkDto | 'requeued'>(
      async () => {
        const held = await this.sandboxes.liveKeysIn(
          claimant.workspaceId.value,
          this.clock.now(),
        );
        const claimed = await this.runs.claimNext(
          {
            ...claimant,
            sandbox: { avoiding: held.map((each) => ResumeKey.of(each)) },
          },
          this.clock.now(),
        );
        const start = claimed
          ? await this.starting.mayStart(claimed, claimant.runner, until)
          : null;

        if (start === 'requeued') {
          return start;
        }

        if (claimed && start === 'starts') {
          await this.taken.run(claimed, claimant.runner);

          return claimedRun(claimed);
        }

        const check = await this.checks.claimReserved(
          claimant.runner,
          claimant.offer,
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

    return found === 'requeued' ? null : found;
  }
}

import type { RunnerHeartbeatsPort } from '@runners/application/ports/runner-heartbeats.port';
import type { SandboxesPort } from '@runners/application/ports/sandboxes.port';
import type { ClaimRunCommand } from '@runs/application/commands/runner.commands';
import type { ClaimedWorkDto } from '@runs/application/dto/run.dto';
import type { CheckWorkPort } from '@runs/application/ports/check-work.port';
import type { ClaimGate } from '@runs/application/services/claim-gate.service';
import { claimedRun } from '@runs/application/services/claimed-work';
import type { ClaimsTaken } from '@runs/application/services/claims-taken.service';
import type { LongPoll } from '@runs/application/services/long-poll';
import type { ProvisionFailures } from '@runs/application/services/provision-failures.service';
import type { RunClaims } from '@runs/application/services/run-claims.service';
import { UnknownRunnerError } from '@runs/domain/exceptions/unknown-runner.error';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import type { Claimant } from '@runs/domain/value-objects/claimant';
import { WorkspaceKey } from '@runs/domain/value-objects/workspace-key.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class ClaimRunHandler
  implements CommandHandlerPort<ClaimRunCommand, ClaimedWorkDto | null>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly claims: RunClaims,
    private readonly heartbeats: RunnerHeartbeatsPort,
    private readonly clock: ClockPort,
    private readonly checks: CheckWorkPort,
    private readonly taken: ClaimsTaken,
    private readonly failures: ProvisionFailures,
    private readonly starting: ClaimGate,
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
        const claimed = await this.claims.next(
          {
            ...claimant,
            sandbox: { avoiding: held.map((each) => WorkspaceKey.parse(each)) },
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

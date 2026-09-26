import type { RunnerAdmissionsPort } from '@runners/application/ports/runner-admissions.port';
import type { RunnerPresencePort } from '@runners/application/ports/runner-presence.port';
import type { RunnersPort } from '@runners/application/ports/runners.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { ClaimHostWorkCommand } from '@work/application/commands/runner.commands';
import type { HostClaimDto } from '@work/application/dto/host.dto';
import type { ClaimedWorkDto } from '@work/application/dto/run.dto';
import type { CheckWorkPort } from '@work/application/ports/check-work.port';
import { claimedRun } from '@work/application/services/claimed-work';
import { longPolled, pollDeadline } from '@work/application/services/long-poll';
import type { RunLeases } from '@work/application/services/run-leases.service';
import type {
  Claimant,
  RunRepository,
} from '@work/domain/repositories/run.repository';

const CLAIM_WINDOW_MS = 60_000;

export class ClaimHostWorkHandler
  implements CommandHandlerPort<ClaimHostWorkCommand, HostClaimDto>
{
  constructor(
    private readonly admissions: RunnerAdmissionsPort,
    private readonly runners: RunnersPort,
    private readonly presence: RunnerPresencePort,
    private readonly runs: RunRepository,
    private readonly leases: RunLeases,
    private readonly checks: CheckWorkPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: ClaimHostWorkCommand): Promise<HostClaimDto> {
    try {
      const admitted = await this.admissions.admit(command.credential);

      if (!admitted) {
        return { outcome: 'refused' };
      }

      const until = pollDeadline(this.clock);
      const started = await longPolled(
        this.clock,
        async () => {
          const now = this.clock.now();
          const attempt = await this.runners.start(
            admitted.way,
            command.host,
            command.image,
            now,
            new Date(now.getTime() + CLAIM_WINDOW_MS),
          );

          return attempt.outcome === 'full' ? null : attempt;
        },
        until,
      );

      if (!started) {
        return { outcome: 'nothing' };
      }

      if (started.outcome !== 'started') {
        return started.outcome === 'stranger' || started.outcome === 'unoffered'
          ? { outcome: started.outcome }
          : { outcome: 'refused' };
      }

      let work: ClaimedWorkDto | null = null;
      try {
        work = await this.claimed(started.runnerId, until);
      } finally {
        if (!work) {
          await this.runners.letGo(started.runnerId, this.clock.now());
        }
      }

      if (!work) {
        return { outcome: 'nothing' };
      }

      return {
        outcome: 'claimed',
        runnerId: started.runnerId.value,
        token: started.token,
        egressToken: started.egressToken,
        work,
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async claimed(
    runner: RunnerId,
    until: Date,
  ): Promise<ClaimedWorkDto | null> {
    const seen = await this.presence.seen(runner, this.clock.now());

    if (!seen) {
      return null;
    }

    await this.leases.requeueLapsed(this.clock.now());

    const claimant: Claimant = {
      runner,
      workspaceId: seen.workspaceId,
      harnesses: seen.harnesses,
      terms: seen.terms,
      claims: 'any',
    };

    return longPolled(
      this.clock,
      async () => {
        const run = await this.runs.claimNext(claimant, this.clock.now());

        if (run) {
          await this.runners.took(
            runner,
            { kind: 'run', id: run.id.value },
            this.clock.now(),
          );

          return claimedRun(run);
        }

        const check = await this.checks.claimNext(
          seen.workspaceId,
          runner,
          seen.terms,
          this.clock.now(),
        );

        if (check) {
          await this.runners.took(
            runner,
            { kind: 'check', id: check.stackId },
            this.clock.now(),
          );

          return { kind: 'check', check };
        }

        return null;
      },
      until,
    );
  }
}

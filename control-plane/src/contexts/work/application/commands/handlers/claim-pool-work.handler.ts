import type { PoolRunnersPort } from '@runners/application/ports/pool-runners.port';
import type { RunnerPoolsPort } from '@runners/application/ports/runner-pools.port';
import type { RunnerPresencePort } from '@runners/application/ports/runner-presence.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { ClaimPoolWorkCommand } from '@work/application/commands/runner.commands';
import type { PoolClaimDto } from '@work/application/dto/pool.dto';
import type { ClaimedWorkDto } from '@work/application/dto/run.dto';
import type { CheckWorkPort } from '@work/application/ports/check-work.port';
import { claimedRun } from '@work/application/services/claimed-work';
import { longPolled } from '@work/application/services/long-poll';
import type { RunLeases } from '@work/application/services/run-leases.service';
import type {
  Claimant,
  RunRepository,
} from '@work/domain/repositories/run.repository';

const CLAIM_WINDOW_MS = 60_000;

export class ClaimPoolWorkHandler
  implements CommandHandlerPort<ClaimPoolWorkCommand, PoolClaimDto>
{
  constructor(
    private readonly pools: RunnerPoolsPort,
    private readonly pooled: PoolRunnersPort,
    private readonly presence: RunnerPresencePort,
    private readonly runs: RunRepository,
    private readonly leases: RunLeases,
    private readonly checks: CheckWorkPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: ClaimPoolWorkCommand): Promise<PoolClaimDto> {
    try {
      const pool = await this.pools.pulledWith(command.token);

      if (!pool) {
        return { outcome: 'refused' };
      }

      const now = this.clock.now();
      const started = await this.pooled.start(
        pool.poolId,
        command.harnesses,
        now,
        new Date(now.getTime() + CLAIM_WINDOW_MS),
      );

      if (started.outcome !== 'started') {
        return started.outcome === 'gone'
          ? { outcome: 'refused' }
          : { outcome: 'nothing' };
      }

      const work = await this.claimed(started.runnerId);

      if (!work) {
        await this.pooled.letGo(started.runnerId, this.clock.now());

        return { outcome: 'nothing' };
      }

      return {
        outcome: 'claimed',
        runnerId: started.runnerId.value,
        token: started.token,
        work,
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async claimed(runner: RunnerId): Promise<ClaimedWorkDto | null> {
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

    return longPolled(this.clock, async () => {
      const run = await this.runs.claimNext(claimant, this.clock.now());

      if (run) {
        await this.pooled.took(
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
        await this.pooled.took(
          runner,
          { kind: 'check', id: check.stackId },
          this.clock.now(),
        );

        return { kind: 'check', check };
      }

      return null;
    });
  }
}

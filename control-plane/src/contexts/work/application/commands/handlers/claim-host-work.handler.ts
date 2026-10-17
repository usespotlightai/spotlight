import type { RunnerAuthenticatorPort } from '@runners/application/ports/runner-authenticator.port';
import type { RunnerHeartbeatsPort } from '@runners/application/ports/runner-heartbeats.port';
import type { RunnersPort } from '@runners/application/ports/runners.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { ClaimHostWorkCommand } from '@work/application/commands/runner.commands';
import type { HostClaimDto } from '@work/application/dto/host.dto';
import type { ClaimedWorkDto } from '@work/application/dto/run.dto';
import type { CheckWorkPort } from '@work/application/ports/check-work.port';
import { claimedRun } from '@work/application/services/claimed-work';
import type { ClaimsTaken } from '@work/application/services/claims-taken.service';
import type { LongPoll } from '@work/application/services/long-poll';
import type { RunLeases } from '@work/application/services/run-leases.service';
import type { RunStartHooks } from '@work/application/services/run-start-hooks.service';
import type {
  Claimant,
  RunRepository,
} from '@work/domain/repositories/run.repository';

const CLAIM_WINDOW_MS = 60_000;

export class ClaimHostWorkHandler
  implements CommandHandlerPort<ClaimHostWorkCommand, HostClaimDto>
{
  constructor(
    private readonly authenticator: RunnerAuthenticatorPort,
    private readonly runners: RunnersPort,
    private readonly heartbeats: RunnerHeartbeatsPort,
    private readonly runs: RunRepository,
    private readonly leases: RunLeases,
    private readonly checks: CheckWorkPort,
    private readonly clock: ClockPort,
    private readonly starting: RunStartHooks,
    private readonly taken: ClaimsTaken,
    private readonly polls: LongPoll,
  ) {}

  async execute(command: ClaimHostWorkCommand): Promise<HostClaimDto> {
    try {
      const authenticated = await this.authenticator.authenticate(
        command.credential,
      );

      if (!authenticated) {
        return { outcome: 'unauthorized' };
      }

      const until = this.polls.deadline();
      const started = await this.polls.polled(async () => {
        const now = this.clock.now();
        const attempt = await this.runners.start(
          authenticated.source,
          command.host,
          command.image,
          now,
          new Date(now.getTime() + CLAIM_WINDOW_MS),
        );

        return attempt.outcome === 'full' ? null : attempt;
      }, until);

      if (!started) {
        return { outcome: 'nothing' };
      }

      if (started.outcome !== 'started') {
        return started.outcome === 'host-unreported' ||
          started.outcome === 'image-unreported'
          ? { outcome: started.outcome }
          : { outcome: 'unauthorized' };
      }

      let work: ClaimedWorkDto | null = null;
      try {
        work = await this.claimed(started.runnerId, until);
      } finally {
        if (!work) {
          await this.runners.release(started.runnerId, this.clock.now());
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
      rethrowAsApplicationError(error);
    }
  }

  private async claimed(
    runner: RunnerId,
    until: Date,
  ): Promise<ClaimedWorkDto | null> {
    const heartbeat = await this.heartbeats.heartbeat(runner, this.clock.now());

    if (!heartbeat) {
      return null;
    }

    await this.leases.expireLeases(this.clock.now());

    const claimant: Claimant = {
      runner,
      workspaceId: heartbeat.workspaceId,
      harnesses: heartbeat.harnesses,
      terms: heartbeat.terms,
      claims: 'any',
    };

    const found = await this.polls.polled<ClaimedWorkDto | 'requeued'>(
      async () => {
        const run = await this.runs.claimNext(claimant, this.clock.now());
        const start = run
          ? await this.starting.mayStart(run, runner, until)
          : null;

        if (start === 'requeued') {
          return start;
        }

        if (run && start === 'starts') {
          await this.taken.run(run, runner);

          return claimedRun(run);
        }

        const check = await this.checks.claimNext(
          heartbeat.workspaceId,
          runner,
          heartbeat.terms,
          this.clock.now(),
        );

        if (!check) {
          return null;
        }

        await this.taken.check(check, runner);

        return { kind: 'check', check };
      },
      until,
    );

    return found === 'requeued' ? null : found;
  }
}

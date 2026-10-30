import type { RunnerAuthenticatorPort } from '@runners/application/ports/runner-authenticator.port';
import type {
  RunnerHeartbeat,
  RunnerHeartbeatsPort,
} from '@runners/application/ports/runner-heartbeats.port';
import type { RunnersPort } from '@runners/application/ports/runners.port';
import type {
  SandboxesPort,
  SandboxTakingRuns,
  StartedSandbox,
} from '@runners/application/ports/sandboxes.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { ClaimHostWorkCommand } from '@work/application/commands/runner.commands';
import type { HostClaimDto } from '@work/application/dto/host.dto';
import type { ClaimedWorkDto } from '@work/application/dto/run.dto';
import type { CheckWorkPort } from '@work/application/ports/check-work.port';
import type { SandboxHostsPort } from '@work/application/ports/sandbox-hosts.port';
import { claimedRun } from '@work/application/services/claimed-work';
import type { ClaimsTaken } from '@work/application/services/claims-taken.service';
import type { LongPoll } from '@work/application/services/long-poll';
import type { RunLeases } from '@work/application/services/run-leases.service';
import type { RunStartHooks } from '@work/application/services/run-start-hooks.service';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import type {
  Claimant,
  RunRepository,
} from '@work/domain/repositories/run.repository';
import { ClaimOrder } from '@work/domain/services/claim-order';
import { ResumeKey } from '@work/domain/value-objects/resume-key.vo';

const CLAIM_WINDOW_MS = 60_000;

type Claimed =
  | {
      readonly kind: 'work';
      readonly work: ClaimedWorkDto;
      readonly sandboxId: string | null;
      readonly sandboxToken: string | null;
      readonly reused: boolean;
    }
  | { readonly kind: 'sandbox'; readonly sandbox: StartedSandbox };

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
    private readonly sandboxes: SandboxesPort,
    private readonly sandboxHosts: SandboxHostsPort,
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
      const { sandbox } = command;
      const into = sandbox
        ? await this.polls.polled(
            () => this.sandboxes.takingRuns(sandbox, command.host),
            until,
          )
        : null;

      if (sandbox && !into) {
        return { outcome: 'nothing' };
      }

      const started = await this.polls.polled(async () => {
        const now = this.clock.now();
        const attempt = await this.runners.start(
          authenticated.source,
          command.host,
          command.image,
          now,
          new Date(now.getTime() + CLAIM_WINDOW_MS),
          into?.id ?? null,
        );

        return attempt.outcome === 'full' ? null : attempt;
      }, until);

      if (!started) {
        return { outcome: 'nothing' };
      }

      if (started.outcome === 'host-outdated') {
        return started;
      }

      if (started.outcome !== 'started') {
        return started.outcome === 'host-unreported' ||
          started.outcome === 'image-unreported'
          ? { outcome: started.outcome }
          : { outcome: 'unauthorized' };
      }

      let claimed: Claimed | null = null;
      try {
        claimed = into
          ? await this.claimedInto(started.runnerId, command.host, into, until)
          : await this.claimed(started.runnerId, command.host, until);
      } finally {
        if (claimed?.kind !== 'work') {
          await this.runners.release(started.runnerId, this.clock.now());
        }
      }

      if (!claimed) {
        return { outcome: 'nothing' };
      }

      if (claimed.kind === 'sandbox') {
        return {
          outcome: 'sandbox',
          sandboxId: claimed.sandbox.id,
          sandboxToken: claimed.sandbox.token,
          allowedHosts: this.sandboxHosts.hosts(),
        };
      }

      return {
        outcome: 'claimed',
        runnerId: started.runnerId.value,
        token: started.token,
        egressToken: started.egressToken,
        sandboxId: claimed.sandboxId,
        sandboxToken: claimed.sandboxToken,
        reused: claimed.reused,
        work: claimed.work,
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async claimed(
    runner: RunnerId,
    host: string,
    until: Date,
  ): Promise<Claimed | null> {
    const heartbeat = await this.heartbeats.heartbeat(runner, this.clock.now());

    if (!heartbeat) {
      return null;
    }

    await this.leases.expireLeases(this.clock.now());

    const found = await this.polls.polled<Claimed | 'requeued'>(async () => {
      const held = await this.sandboxes.liveKeysIn(
        heartbeat.workspaceId.value,
        this.clock.now(),
      );
      const claimant: Claimant = {
        runner,
        workspaceId: heartbeat.workspaceId,
        harnesses: heartbeat.harnesses,
        offer: heartbeat.offer,
        claims: 'any',
        sandbox: { avoiding: held.map((each) => ResumeKey.of(each)) },
      };
      const run = await this.runs.claimNext(claimant, this.clock.now());
      const start = run
        ? await this.starting.mayStart(run, runner, until)
        : null;

      if (start === 'requeued') {
        return start;
      }

      if (run && start === 'starts') {
        await this.taken.run(run, runner);

        const sandbox = await this.sandboxes.holdForRun(
          {
            workspaceId: run.workspaceId.value,
            key: run.resumeKey?.value ?? null,
            hostId: host,
            runId: run.id.value,
          },
          this.clock.now(),
        );

        return {
          kind: 'work',
          work: claimedRun(run),
          sandboxId: sandbox.id,
          sandboxToken: sandbox.token,
          reused: false,
        };
      }

      const requested = await this.requestedSandbox(heartbeat, host);

      if (requested) {
        return { kind: 'sandbox', sandbox: requested };
      }

      const check = await this.checks.claimNext(
        heartbeat.workspaceId,
        runner,
        heartbeat.offer,
        this.clock.now(),
      );

      if (!check) {
        return null;
      }

      await this.taken.check(check, runner);

      return {
        kind: 'work',
        work: { kind: 'check', check },
        sandboxId: null,
        sandboxToken: null,
        reused: false,
      };
    }, until);

    return found === 'requeued' ? null : found;
  }

  private async requestedSandbox(
    heartbeat: RunnerHeartbeat,
    host: string,
  ): Promise<StartedSandbox | null> {
    for (const requested of await this.sandboxes.requestedIn(
      heartbeat.workspaceId.value,
    )) {
      const newest = await this.runs.newestWithKey(
        heartbeat.workspaceId,
        ResumeKey.of(requested.key),
      );

      if (newest && !ClaimOrder.fits(newest, heartbeat)) {
        continue;
      }

      const started = await this.sandboxes.startRequested(
        requested.id,
        host,
        this.clock.now(),
      );

      if (started) {
        return started;
      }
    }

    return null;
  }

  private async claimedInto(
    runner: RunnerId,
    host: string,
    into: SandboxTakingRuns,
    until: Date,
  ): Promise<Claimed | null> {
    const heartbeat = await this.heartbeats.heartbeat(runner, this.clock.now());

    if (!heartbeat || heartbeat.workspaceId.value !== into.workspaceId) {
      return null;
    }

    await this.leases.expireLeases(this.clock.now());

    const claimant: Claimant = {
      runner,
      workspaceId: heartbeat.workspaceId,
      harnesses: heartbeat.harnesses,
      offer: heartbeat.offer,
      claims: 'any',
      sandbox: { into: ResumeKey.of(into.key) },
    };

    const queued = await this.runs.queuedWithKey(
      heartbeat.workspaceId,
      ResumeKey.of(into.key),
    );

    if (queued.some((each) => !ClaimOrder.fits(each, claimant))) {
      await this.sandboxes.drain(into.id);
      return null;
    }

    const found = await this.polls.polled<Run | 'requeued'>(async () => {
      const run = await this.runs.claimNext(claimant, this.clock.now());
      const start = run
        ? await this.starting.mayStart(run, runner, until)
        : null;

      return start === 'requeued' ? start : start === 'starts' ? run : null;
    }, until);

    if (!found || found === 'requeued') {
      return null;
    }

    await this.taken.run(found, runner);

    const held = await this.sandboxes.holdInSandbox(
      into.id,
      {
        workspaceId: found.workspaceId.value,
        key: found.resumeKey?.value ?? null,
        hostId: host,
        runId: found.id.value,
      },
      this.clock.now(),
    );

    if (!held) {
      await this.taken.dropRun(found, runner);
      return null;
    }

    return {
      kind: 'work',
      work: claimedRun(found),
      sandboxId: into.id,
      sandboxToken: null,
      reused: true,
    };
  }
}

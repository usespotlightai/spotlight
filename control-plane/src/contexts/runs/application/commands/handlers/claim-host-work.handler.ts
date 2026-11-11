import type { RunnerAuthenticatorPort } from '@runners/application/ports/runner-authenticator.port';
import type {
  RunnerClaimant,
  RunnerClaimantsPort,
} from '@runners/application/ports/runner-claimants.port';
import type { RunnersPort } from '@runners/application/ports/runners.port';
import type {
  SandboxesPort,
  SandboxForRun,
  SandboxTakingRuns,
  StartedSandbox,
  WarmStart,
} from '@runners/application/ports/sandboxes.port';
import type { ClaimHostWorkCommand } from '@runs/application/commands/runner.commands';
import type { HostClaimDto } from '@runs/application/dto/host.dto';
import type { ClaimedWorkDto } from '@runs/application/dto/run.dto';
import type { CheckWorkPort } from '@runs/application/ports/check-work.port';
import type { SandboxHostsPort } from '@runs/application/ports/sandbox-hosts.port';
import type { ClaimGate } from '@runs/application/services/claim-gate.service';
import { claimedRun } from '@runs/application/services/claimed-work';
import type { ClaimsTaken } from '@runs/application/services/claims-taken.service';
import type { LongPoll } from '@runs/application/services/long-poll';
import type { RunClaims } from '@runs/application/services/run-claims.service';
import type { Run } from '@runs/domain/aggregates/run.aggregate';
import type { RunRepository } from '@runs/domain/repositories/run.repository';
import { ClaimOrder } from '@runs/domain/services/claim-order';
import type {
  Claimant,
  SandboxRouting,
} from '@runs/domain/value-objects/claimant';
import { WorkingCopyKey } from '@runs/domain/value-objects/working-copy-key.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { distinct } from '@shared-kernel/domain/distinct';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const CLAIM_WINDOW_MS = 60_000;

const sandboxForRun = (run: Run, host: string): SandboxForRun => ({
  workspaceId: run.workspaceId.value,
  key: run.workingCopyKey?.value ?? null,
  line: run.line?.value ?? null,
  hostId: host,
  runId: run.id.value,
});

const claimantOf = (
  runner: RunnerId,
  registered: RunnerClaimant,
  sandbox: SandboxRouting,
): Claimant => ({
  runner,
  workspaceId: registered.workspaceId,
  harnesses: registered.harnesses,
  offer: registered.offer,
  claims: 'any',
  sandbox,
});

type Claimed =
  | {
      readonly kind: 'work';
      readonly work: ClaimedWorkDto;
      readonly sandboxId: string | null;
      readonly sandboxToken: string | null;
      readonly reused: boolean;
    }
  | {
      readonly kind: 'sandbox';
      readonly sandbox: StartedSandbox;
      readonly warm: WarmStart | null;
    };

export class ClaimHostWorkHandler implements CommandHandlerPort<
  ClaimHostWorkCommand,
  HostClaimDto
> {
  constructor(
    private readonly authenticator: RunnerAuthenticatorPort,
    private readonly runners: RunnersPort,
    private readonly claimants: RunnerClaimantsPort,
    private readonly runs: RunRepository,
    private readonly claims: RunClaims,
    private readonly checks: CheckWorkPort,
    private readonly clock: ClockPort,
    private readonly starting: ClaimGate,
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
          warm: claimed.warm,
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
    const registered = await this.claimants.claimantOf(
      runner,
      this.clock.now(),
    );

    if (!registered) {
      return null;
    }

    const found = await this.polls.polled<Claimed | 'requeued'>(async () => {
      const requested = await this.claimedForRequested(
        runner,
        registered,
        host,
        until,
      );

      if (requested) {
        return requested;
      }

      const held = await this.sandboxes.liveKeysIn(
        registered.workspaceId.value,
        this.clock.now(),
      );
      const avoiding = held.map((each) => WorkingCopyKey.parse(each));
      const waiting = await this.waitingForWarm(
        registered.workspaceId,
        avoiding,
      );
      const run = await this.startedRun(
        claimantOf(runner, registered, {
          avoiding: [...avoiding, ...waiting],
        }),
        host,
        until,
      );

      if (run) {
        return run;
      }

      const warm = await this.startedWarm(registered, host);

      if (warm) {
        return warm;
      }

      const check = await this.checks.claimNext(
        registered.workspaceId,
        runner,
        registered.offer,
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

  private async startedRun(
    claimant: Claimant,
    host: string,
    until: Date,
  ): Promise<Claimed | 'requeued' | null> {
    const run = await this.claims.next(claimant, this.clock.now());
    const start = run
      ? await this.starting.mayStart(run, claimant.runner, until)
      : null;

    if (start === 'requeued') {
      return start;
    }

    if (!run || start !== 'starts') {
      return null;
    }

    await this.taken.run(run, claimant.runner);

    const sandbox = await this.sandboxes
      .holdForRun(sandboxForRun(run, host), this.clock.now())
      .catch(async (error: unknown) => {
        await this.taken.dropRun(run, claimant.runner).catch(() => undefined);
        throw error;
      });

    return {
      kind: 'work',
      work: claimedRun(run),
      sandboxId: sandbox.id,
      sandboxToken: sandbox.token,
      reused: false,
    };
  }

  private async claimedForRequested(
    runner: RunnerId,
    registered: RunnerClaimant,
    host: string,
    until: Date,
  ): Promise<Claimed | 'requeued' | null> {
    for (const requested of await this.sandboxes.requestedIn(
      registered.workspaceId.value,
    )) {
      const key = WorkingCopyKey.parse(requested.key);
      const newest = await this.runs.newestWithKey(registered.workspaceId, key);
      const claim = ClaimOrder.forRequested(newest, registered);

      if (claim === 'skip') {
        continue;
      }

      if (claim === 'run-of-its-key') {
        const run = await this.startedRun(
          claimantOf(runner, registered, { into: key }),
          host,
          until,
        );

        if (run) {
          return run;
        }
      }

      const started = await this.sandboxes.startRequested(
        requested.id,
        host,
        this.clock.now(),
      );

      if (started) {
        return { kind: 'sandbox', sandbox: started, warm: null };
      }
    }

    return null;
  }

  private async waitingForWarm(
    workspaceId: WorkspaceId,
    avoiding: readonly WorkingCopyKey[],
  ): Promise<readonly WorkingCopyKey[]> {
    const now = this.clock.now();
    const ready = (
      await this.sandboxes.readyWarmIn(workspaceId.value, now)
    ).map((each) => ({ line: LineId.of(each.line) }));

    if (ready.length === 0) {
      return [];
    }

    const firstRuns = await this.runs.queuedFirstRuns(workspaceId, {
      lines: distinct(ready.map((each) => each.line)),
      avoiding,
      queuedSince: ClaimOrder.warmWaitSince(now),
    });

    return ClaimOrder.reservedForWarm({ ready, firstRuns, avoiding, now });
  }

  private async startedWarm(
    registered: RunnerClaimant,
    host: string,
  ): Promise<Claimed | null> {
    for (const requested of await this.sandboxes.requestedWarmIn(
      registered.workspaceId.value,
    )) {
      const started = await this.sandboxes.startWarm(
        requested,
        host,
        registered.offer,
        this.clock.now(),
      );

      if (started) {
        return { kind: 'sandbox', sandbox: started, warm: started.warm };
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
    const registered = await this.claimants.claimantOf(
      runner,
      this.clock.now(),
    );

    if (!registered || registered.workspaceId.value !== into.workspaceId) {
      return null;
    }

    if ('warmFor' in into) {
      return this.claimedIntoWarm(runner, registered, host, into, until);
    }

    const claimant = claimantOf(runner, registered, {
      into: WorkingCopyKey.parse(into.key),
    });

    const queued = await this.runs.queuedWithKey(
      registered.workspaceId,
      WorkingCopyKey.parse(into.key),
    );

    if (queued.some((each) => !ClaimOrder.fits(each, claimant))) {
      await this.sandboxes.drain(into.id);
      return null;
    }

    const found = await this.polls.polled<Run | 'requeued'>(async () => {
      const run = await this.claims.next(claimant, this.clock.now());
      const start = run
        ? await this.starting.mayStart(run, runner, until)
        : null;

      return start === 'requeued' ? start : start === 'starts' ? run : null;
    }, until);

    if (!found || found === 'requeued') {
      return null;
    }

    return this.heldOrDropped(found, runner, into.id, (forRun, at) =>
      this.sandboxes.holdInSandbox(into.id, forRun({ host }), at),
    );
  }

  private async claimedIntoWarm(
    runner: RunnerId,
    registered: RunnerClaimant,
    host: string,
    into: { readonly id: string; readonly warmFor: string },
    until: Date,
  ): Promise<Claimed | null> {
    const found = await this.polls.polled<Run | 'requeued'>(async () => {
      const now = this.clock.now();
      const workspaceId = registered.workspaceId.value;
      const held = [
        ...(await this.sandboxes.liveKeysIn(workspaceId, now)),
        ...(await this.sandboxes.requestedIn(workspaceId)).map(
          (each) => each.key,
        ),
      ];
      const run = await this.claims.next(
        claimantOf(runner, registered, {
          firstOfLine: LineId.of(into.warmFor),
          avoiding: held.map((each) => WorkingCopyKey.parse(each)),
        }),
        now,
      );
      const start = run
        ? await this.starting.mayStart(run, runner, until)
        : null;

      return start === 'requeued' ? start : start === 'starts' ? run : null;
    }, until);

    if (!found || found === 'requeued') {
      return null;
    }

    return this.heldOrDropped(found, runner, into.id, (forRun, at) =>
      this.sandboxes.adoptForRun(into.id, forRun({ host }), at),
    );
  }

  private async heldOrDropped(
    found: Run,
    runner: RunnerId,
    sandboxId: string,
    hold: (
      forRun: (on: { host: string }) => SandboxForRun,
      at: Date,
    ) => Promise<boolean>,
  ): Promise<Claimed | null> {
    await this.taken.run(found, runner);

    const held = await hold(
      ({ host }) => sandboxForRun(found, host),
      this.clock.now(),
    ).catch(async (error: unknown) => {
      await this.taken.dropRun(found, runner).catch(() => undefined);
      throw error;
    });

    if (!held) {
      await this.taken.dropRun(found, runner);
      return null;
    }

    return {
      kind: 'work',
      work: claimedRun(found),
      sandboxId,
      sandboxToken: null,
      reused: true,
    };
  }
}

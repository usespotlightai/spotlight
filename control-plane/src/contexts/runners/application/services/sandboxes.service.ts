import type {
  EditorSandbox,
  EditorSandboxesPort,
} from '@runners/application/ports/editor-sandboxes.port';
import type { SandboxPlacementsPort } from '@runners/application/ports/sandbox-placements.port';
import type { SandboxUpkeepPort } from '@runners/application/ports/sandbox-upkeep.port';
import type {
  AuthenticatedSandbox,
  OpenedSandbox,
  ReadyWarmSandbox,
  RequestedSandbox,
  SandboxesPort,
  SandboxForRun,
  SandboxTakingRuns,
  StartedSandbox,
  StartedWarmSandbox,
} from '@runners/application/ports/sandboxes.port';
import { reviseSandbox } from '@runners/application/services/sandbox-revisions';
import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import { SandboxKeyTakenError } from '@runners/domain/exceptions/sandbox-key-taken.error';
import { SandboxVersionConflictError } from '@runners/domain/exceptions/sandbox-version-conflict.error';
import { UnknownHostError } from '@runners/domain/exceptions/unknown-host.error';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import type { SandboxRepository } from '@runners/domain/repositories/sandbox.repository';
import { sandboxesToDrainOn } from '@runners/domain/services/sandbox-drains';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { LeaseHolder } from '@runners/domain/value-objects/lease-holder.vo';
import type { SandboxDrainPolicy } from '@runners/domain/value-objects/sandbox-drain-policy.vo';
import { SandboxKey } from '@runners/domain/value-objects/sandbox-key.vo';
import { SandboxLease } from '@runners/domain/value-objects/sandbox-lease.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const ATTEMPTS = 3;

const REQUESTS_PER_CLAIM = 20;

const editorSandboxOf = (
  sandbox: Sandbox,
  host: RunnerHost | null,
  now: Date,
): EditorSandbox => ({
  open: sandbox.isOpen,
  ready: sandbox.isReadyOn(host, now),
});

export class Sandboxes
  implements SandboxesPort, EditorSandboxesPort, SandboxUpkeepPort
{
  constructor(
    private readonly sandboxes: SandboxRepository,
    private readonly hosts: RunnerHostRepository,
    private readonly placements: SandboxPlacementsPort,
    private readonly policy: SandboxDrainPolicy,
    private readonly ids: IdGeneratorPort,
    private readonly tokens: TokenIssuer,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async holdForRun(run: SandboxForRun, at: Date): Promise<StartedSandbox> {
    const workspaceId = WorkspaceId.of(run.workspaceId);
    const key = run.key === null ? null : SandboxKey.of(run.key);
    const host = await this.hosts.find(HostId.of(run.hostId));

    if (!host) {
      throw new UnknownHostError(run.hostId);
    }

    for (let attempt = 1; ; attempt++) {
      const issued = this.tokens.issue();
      const tokenHash = TokenHash.of(issued.hash);

      try {
        const open = key
          ? await this.sandboxes.openFor(workspaceId, key)
          : null;

        if (open?.isRequested) {
          const placed = open
            .placeOn(host, tokenHash, at)
            .holdRun(RunId.of(run.runId), at);

          await this.sandboxes.save(placed);
          return { id: placed.id.value, token: issued.token };
        }

        if (open) {
          const replaced = open.replacedForRun();

          if (replaced !== open) {
            await this.sandboxes.save(replaced);
          }
        }

        const started = Sandbox.startForRun({
          id: SandboxId.of(this.ids.generate()),
          workspaceId,
          key,
          host,
          tokenHash,
          runId: RunId.of(run.runId),
          at,
        });

        await this.sandboxes.add(started);
        return { id: started.id.value, token: issued.token };
      } catch (error) {
        if (
          !(error instanceof SandboxVersionConflictError) ||
          attempt >= ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }

  async takingRuns(
    sandboxId: string,
    hostId: string,
  ): Promise<SandboxTakingRuns | null> {
    const found = await this.sandboxes.find(SandboxId.of(sandboxId));
    const host = found ? await this.hosts.find(HostId.of(hostId)) : null;
    const now = this.clock.now();

    if (!found || !host) {
      return null;
    }

    if (found.key && found.takesRunOn(host, now)) {
      return {
        id: found.id.value,
        workspaceId: found.workspaceId.value,
        key: found.key.value,
      };
    }

    return found.warm && found.takesFirstRunOn(host, now)
      ? {
          id: found.id.value,
          workspaceId: found.workspaceId.value,
          warmFor: found.warm.lineId.value,
          fingerprint: found.warm.fingerprint,
        }
      : null;
  }

  holdInSandbox(
    sandboxId: string,
    run: SandboxForRun,
    at: Date,
  ): Promise<boolean> {
    return this.heldIn(sandboxId, run, (sandbox, forRun, host) =>
      sandbox.holdRunFor(forRun, host, at),
    );
  }

  adoptForRun(
    sandboxId: string,
    run: SandboxForRun,
    at: Date,
  ): Promise<boolean> {
    return this.heldIn(sandboxId, run, (sandbox, forRun, host) =>
      sandbox.adoptFor(forRun, host, at),
    );
  }

  private async heldIn(
    sandboxId: string,
    run: SandboxForRun,
    change: (
      sandbox: Sandbox,
      forRun: {
        runId: RunId;
        workspaceId: WorkspaceId;
        key: SandboxKey | null;
        line: LineId | null;
        lineFingerprint: string | null;
      },
      host: RunnerHost,
    ) => Sandbox,
  ): Promise<boolean> {
    const found = await this.sandboxes.find(SandboxId.of(sandboxId));
    const host = found ? await this.hosts.find(HostId.of(run.hostId)) : null;

    if (!found || !host) {
      return false;
    }

    const forRun = {
      runId: RunId.of(run.runId),
      workspaceId: WorkspaceId.of(run.workspaceId),
      key: run.key === null ? null : SandboxKey.of(run.key),
      line: run.line === null ? null : LineId.of(run.line),
      lineFingerprint: run.lineFingerprint,
    };
    try {
      const held = await reviseSandbox(this.sandboxes, found, (sandbox) =>
        change(sandbox, forRun, host),
      );

      return held?.holdsRun(forRun.runId) ?? false;
    } catch (error) {
      if (error instanceof SandboxKeyTakenError) {
        return false;
      }

      throw error;
    }
  }

  async liveKeysIn(workspaceId: string, at: Date): Promise<readonly string[]> {
    const workspace = WorkspaceId.of(workspaceId);
    const hosts = await this.hosts.inWorkspace(workspace);
    const hostOf = (sandbox: Sandbox) =>
      hosts.find((host) => sandbox.isOn(host.id)) ?? null;

    return (await this.sandboxes.liveIn(workspace)).flatMap((sandbox) =>
      sandbox.key && sandbox.isLiveOn(hostOf(sandbox), at)
        ? [sandbox.key.value]
        : [],
    );
  }

  async releaseRun(runId: string, at: Date): Promise<void> {
    const run = RunId.of(runId);

    for (const holding of await this.sandboxes.holdingRun(run)) {
      await reviseSandbox(this.sandboxes, holding, (sandbox) =>
        sandbox.releaseRun(run, at),
      );
    }
  }

  async retireRun(runId: string, at: Date): Promise<void> {
    const run = RunId.of(runId);

    for (const holding of await this.sandboxes.holdingRun(run)) {
      await reviseSandbox(this.sandboxes, holding, (sandbox) =>
        sandbox.retireRun(run, at),
      );
    }
  }

  async open(
    workspaceId: string,
    key: string,
    at: Date,
  ): Promise<OpenedSandbox> {
    const workspace = WorkspaceId.of(workspaceId);
    const sandboxKey = SandboxKey.of(key);

    for (let attempt = 1; ; attempt++) {
      const open = await this.sandboxes.openFor(workspace, sandboxKey);

      if (open) {
        return {
          id: open.id.value,
          state: open.statusOn(await this.hostOf(open), at),
        };
      }

      const requested = Sandbox.request({
        id: SandboxId.of(this.ids.generate()),
        workspaceId: workspace,
        key: sandboxKey,
        at,
      });

      try {
        await this.sandboxes.add(requested);

        this.logger.info(
          { sandboxId: requested.id.value, workspaceId, key },
          'Requested a sandbox with no run',
        );

        return {
          id: requested.id.value,
          state: requested.statusOn(null, at),
        };
      } catch (error) {
        if (
          !(error instanceof SandboxVersionConflictError) ||
          attempt >= ATTEMPTS
        ) {
          throw error;
        }
      }
    }
  }

  async requestedIn(workspaceId: string): Promise<readonly RequestedSandbox[]> {
    const requested = await this.sandboxes.requestedIn(
      WorkspaceId.of(workspaceId),
      REQUESTS_PER_CLAIM,
    );

    return requested.flatMap((each) =>
      each.key ? [{ id: each.id.value, key: each.key.value }] : [],
    );
  }

  async startRequested(
    sandboxId: string,
    hostId: string,
    at: Date,
  ): Promise<StartedSandbox | null> {
    const found = await this.sandboxes.find(SandboxId.of(sandboxId));
    const host = found?.isRequested
      ? await this.hosts.find(HostId.of(hostId))
      : null;

    if (!found?.isRequested || !host) {
      return null;
    }

    const issued = this.tokens.issue();

    try {
      await this.sandboxes.save(
        found.placeOn(host, TokenHash.of(issued.hash), at),
      );
    } catch (error) {
      if (error instanceof SandboxVersionConflictError) {
        return null;
      }

      throw error;
    }

    return { id: found.id.value, token: issued.token };
  }

  async requestedWarmIn(workspaceId: string): Promise<readonly string[]> {
    const warm = await this.sandboxes.openWarmIn(WorkspaceId.of(workspaceId));

    return warm.filter((each) => each.isRequested).map((each) => each.id.value);
  }

  async startWarm(
    sandboxId: string,
    hostId: string,
    offer: RunnerOffer,
    at: Date,
  ): Promise<StartedWarmSandbox | null> {
    const found = await this.sandboxes.find(SandboxId.of(sandboxId));
    const host = found?.warmFits(offer)
      ? await this.hosts.find(HostId.of(hostId))
      : null;

    if (!found?.warm || !host) {
      return null;
    }

    const issued = this.tokens.issue();

    try {
      await this.sandboxes.save(
        found.placeWarmOn(host, offer, TokenHash.of(issued.hash), at),
      );
    } catch (error) {
      if (error instanceof SandboxVersionConflictError) {
        return null;
      }

      throw error;
    }

    this.logger.info(
      { sandboxId, hostId, lineId: found.warm.lineId.value },
      'Starting a warm sandbox',
    );

    return {
      id: found.id.value,
      token: issued.token,
      warm: {
        line: found.warm.lineId.value,
        checkouts: found.warm.checkouts.map((each) => ({
          path: each.path,
          setup: each.setup,
        })),
      },
    };
  }

  async readyWarmIn(
    workspaceId: string,
    at: Date,
  ): Promise<readonly ReadyWarmSandbox[]> {
    const workspace = WorkspaceId.of(workspaceId);
    const warm = await this.sandboxes.openWarmIn(workspace);
    const hosts = warm.some((each) => each.isPlaced)
      ? await this.hosts.inWorkspace(workspace)
      : [];

    return warm.flatMap((sandbox) => {
      const host = hosts.find((each) => sandbox.isOn(each.id));

      return sandbox.warm && host && sandbox.takesFirstRunOn(host, at)
        ? [
            {
              id: sandbox.id.value,
              line: sandbox.warm.lineId.value,
              fingerprint: sandbox.warm.fingerprint,
            },
          ]
        : [];
    });
  }

  async drain(sandboxId: string): Promise<void> {
    const found = await this.sandboxes.find(SandboxId.of(sandboxId));

    if (!found) {
      return;
    }

    const drained = await reviseSandbox(this.sandboxes, found, (sandbox) =>
      sandbox.drainedWhenPlaced(),
    );

    if (drained && drained !== found) {
      this.logger.info(
        { sandboxId, hostId: found.hostId?.value },
        'Draining a sandbox that cannot take its queued run',
      );
    }
  }

  async holdForEditor(
    sandboxId: string,
    holder: string,
    at: Date,
  ): Promise<EditorSandbox | null> {
    const found = await this.sandboxes.find(SandboxId.of(sandboxId));

    if (!found?.isOpen) {
      return null;
    }

    const editor = LeaseHolder.editor(holder);
    const held = await reviseSandbox(this.sandboxes, found, (sandbox) =>
      sandbox.holdEditor(editor, at),
    );

    return held?.holdsEditor(editor)
      ? editorSandboxOf(held, await this.hostOf(held), at)
      : null;
  }

  async heldByEditor(
    sandboxId: string,
    holder: string,
    at: Date,
  ): Promise<boolean> {
    const found = await this.sandboxes.find(SandboxId.of(sandboxId));

    return (
      !!found?.isOpen &&
      found.withoutExpiredEditors(at).holdsEditor(LeaseHolder.editor(holder))
    );
  }

  async heldByAnEditor(
    workspaceId: string,
    key: string,
    at: Date,
  ): Promise<boolean> {
    const open = await this.sandboxes.openFor(
      WorkspaceId.of(workspaceId),
      SandboxKey.of(key),
    );

    return !!open && open.holdsAnEditorAt(at);
  }

  async releaseEditor(
    sandboxId: string,
    holder: string,
    at: Date,
  ): Promise<void> {
    const found = await this.sandboxes.find(SandboxId.of(sandboxId));

    if (found) {
      const editor = LeaseHolder.editor(holder);

      await reviseSandbox(this.sandboxes, found, (sandbox) =>
        sandbox.releaseEditor(editor, at),
      );
    }
  }

  async stateOf(sandboxId: string): Promise<EditorSandbox | null> {
    const found = await this.sandboxes.find(SandboxId.of(sandboxId));

    return found
      ? editorSandboxOf(found, await this.hostOf(found), this.clock.now())
      : null;
  }

  renewEvery(): number {
    return SandboxLease.editorRenewalMs();
  }

  async readyOn(sandboxId: string): Promise<string | null> {
    const found = await this.sandboxes.find(SandboxId.of(sandboxId));

    const host = found ? await this.hostOf(found) : null;

    return found?.isReadyOn(host, this.clock.now()) && host
      ? host.id.value
      : null;
  }

  async authenticate(
    token: string | undefined,
  ): Promise<AuthenticatedSandbox | null> {
    if (!token) {
      return null;
    }

    const found = await this.sandboxes.liveByTokenHash(
      TokenHash.of(this.tokens.hash(token)),
    );

    return found
      ? {
          id: found.id.value,
          workspaceId: found.workspaceId.value,
          key: found.key?.value ?? null,
        }
      : null;
  }

  async toDrainOn(host: RunnerHost): Promise<readonly string[]> {
    return sandboxesToDrainOn(host, await this.sandboxes.liveOn(host.id))
      .map((each) => each.value)
      .sort();
  }

  async droppedBy(
    hostId: HostId,
    sandboxId: SandboxId,
    at: Date,
  ): Promise<void> {
    const found = await this.sandboxes.find(sandboxId);

    if (found) {
      await reviseSandbox(this.sandboxes, found, (sandbox) =>
        sandbox.droppedBy(hostId, at),
      );
    }
  }

  async drainIdle(now: Date): Promise<void> {
    for (const idle of await this.sandboxes.idleSince(
      new Date(now.getTime() - this.policy.shortestMs),
    )) {
      const drained = await reviseSandbox(this.sandboxes, idle, (sandbox) =>
        sandbox.drainedWhenDue(this.policy, now),
      );

      if (drained && drained !== idle) {
        this.logger.info(
          { sandboxId: idle.id.value, hostId: idle.hostId?.value ?? null },
          'Draining an idle sandbox',
        );
      }
    }

    for (const id of await this.placements.liveOnHostsSilentSince(
      RunnerHost.onlineCutoff(now),
    )) {
      const placed = await this.sandboxes.find(id);
      const host = placed ? await this.hostOf(placed) : null;

      if (placed) {
        await reviseSandbox(this.sandboxes, placed, (sandbox) =>
          sandbox.strandedOn(host, now),
        );
      }
    }

    for (const id of await this.placements.unreportedStartedBefore(
      Sandbox.unreportedStartedBefore(now),
    )) {
      const unreported = await this.sandboxes.find(id);
      const host = unreported ? await this.hostOf(unreported) : null;

      if (unreported && host) {
        await reviseSandbox(this.sandboxes, unreported, (sandbox) =>
          sandbox.unreportedOn(host, now),
        );
      }
    }

    for (const gone of await this.sandboxes.goneBefore(
      Sandbox.goneBefore(now),
    )) {
      if (gone.isExpiredAt(now)) {
        await this.sandboxes.remove(gone);
      }
    }
  }

  private hostOf(sandbox: Sandbox): Promise<RunnerHost | null> {
    return sandbox.hostId
      ? this.hosts.find(sandbox.hostId)
      : Promise.resolve(null);
  }
}

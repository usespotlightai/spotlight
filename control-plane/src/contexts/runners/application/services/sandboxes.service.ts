import type { EditorSandboxesPort } from '@runners/application/ports/editor-sandboxes.port';
import type {
  AuthenticatedSandbox,
  OpenedSandbox,
  RequestedSandbox,
  SandboxesPort,
  SandboxForRun,
  SandboxTakingRuns,
  StartedSandbox,
} from '@runners/application/ports/sandboxes.port';
import { reviseSandbox } from '@runners/application/services/sandbox-revisions';
import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import {
  Sandbox,
  type SandboxState,
} from '@runners/domain/aggregates/sandbox.aggregate';
import { SandboxVersionConflictError } from '@runners/domain/exceptions/sandbox-version-conflict.error';
import type { SandboxRepository } from '@runners/domain/repositories/sandbox.repository';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import type { SandboxDrainPolicy } from '@runners/domain/value-objects/sandbox-drain-policy.vo';
import { SandboxId } from '@runners/domain/value-objects/sandbox-id.vo';
import { SandboxKey } from '@runners/domain/value-objects/sandbox-key.vo';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const ATTEMPTS = 3;

const REQUESTS_PER_CLAIM = 20;

export class Sandboxes implements SandboxesPort, EditorSandboxesPort {
  readonly name = 'Draining idle sandboxes';

  constructor(
    private readonly sandboxes: SandboxRepository,
    private readonly policy: SandboxDrainPolicy,
    private readonly ids: IdGeneratorPort,
    private readonly tokens: TokenIssuer,
    private readonly transaction: TransactionPort,
    private readonly logger: LoggerPort,
  ) {}

  async holdForRun(run: SandboxForRun, at: Date): Promise<StartedSandbox> {
    const workspaceId = WorkspaceId.of(run.workspaceId);
    const key = run.key === null ? null : SandboxKey.of(run.key);
    const hostId = HostId.of(run.hostId);

    for (let attempt = 1; ; attempt++) {
      const issued = this.tokens.issue();
      const tokenHash = TokenHash.of(issued.hash);

      try {
        const id = await this.transaction.inTransaction(async () => {
          const open = key
            ? await this.sandboxes.openFor(workspaceId, key)
            : null;

          if (open?.isRequested) {
            const placed = open
              .placeOn(hostId, tokenHash, at)
              .holdRun(run.runId, at);

            await this.sandboxes.save(placed);
            return placed.id;
          }

          if (open) {
            await this.sandboxes.save(open.drain());
          }

          const started = Sandbox.startForRun({
            id: SandboxId.of(this.ids.generate()),
            workspaceId,
            key,
            hostId,
            tokenHash,
            runId: run.runId,
            at,
          });

          await this.sandboxes.add(started);
          return started.id;
        });

        return { id: id.value, token: issued.token };
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

    if (!found?.key || !found.takesRunOn(HostId.of(hostId))) {
      return null;
    }

    return {
      id: found.id.value,
      workspaceId: found.workspaceId.value,
      key: found.key.value,
    };
  }

  async holdInSandbox(
    sandboxId: string,
    run: SandboxForRun,
    at: Date,
  ): Promise<boolean> {
    const found = await this.sandboxes.find(SandboxId.of(sandboxId));

    if (!found) {
      return false;
    }

    const held = await reviseSandbox(this.sandboxes, found, (sandbox) =>
      sandbox.takesRunOn(HostId.of(run.hostId)) &&
      sandbox.key?.value === run.key &&
      sandbox.workspaceId.value === run.workspaceId
        ? sandbox.holdRun(run.runId, at)
        : sandbox,
    );

    return held?.holdsRun(run.runId) ?? false;
  }

  async liveKeysIn(workspaceId: string, at: Date): Promise<readonly string[]> {
    const keys = await this.sandboxes.liveKeysIn(
      WorkspaceId.of(workspaceId),
      RunnerHost.onlineCutoff(at),
    );

    return keys.map((each) => each.value);
  }

  async releaseRun(runId: string, at: Date): Promise<void> {
    for (const holding of await this.sandboxes.holdingRun(runId)) {
      await reviseSandbox(this.sandboxes, holding, (sandbox) =>
        sandbox.releaseRun(runId, at),
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
        return { id: open.id.value, state: open.current };
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

        return { id: requested.id.value, state: requested.current };
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

    if (!found?.isRequested) {
      return null;
    }

    const issued = this.tokens.issue();

    try {
      await this.sandboxes.save(
        found.placeOn(HostId.of(hostId), TokenHash.of(issued.hash), at),
      );
    } catch (error) {
      if (error instanceof SandboxVersionConflictError) {
        return null;
      }

      throw error;
    }

    return { id: found.id.value, token: issued.token };
  }

  async drain(sandboxId: string): Promise<void> {
    const found = await this.sandboxes.find(SandboxId.of(sandboxId));

    if (!found?.isPlaced) {
      return;
    }

    const drained = await reviseSandbox(this.sandboxes, found, (sandbox) =>
      sandbox.drain(),
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
  ): Promise<SandboxState | null> {
    const found = await this.sandboxes.find(SandboxId.of(sandboxId));

    if (!found?.isOpen) {
      return null;
    }

    const held = await reviseSandbox(this.sandboxes, found, (sandbox) =>
      sandbox.isOpen ? sandbox.holdEditor(holder, at) : sandbox,
    );

    return held?.holdsEditor(holder) ? held.current : null;
  }

  async releaseEditor(
    sandboxId: string,
    holder: string,
    at: Date,
  ): Promise<void> {
    const found = await this.sandboxes.find(SandboxId.of(sandboxId));

    if (found) {
      await reviseSandbox(this.sandboxes, found, (sandbox) =>
        sandbox.releaseEditor(holder, at),
      );
    }
  }

  async stateOf(sandboxId: string): Promise<SandboxState | null> {
    const found = await this.sandboxes.find(SandboxId.of(sandboxId));

    return found?.current ?? null;
  }

  async readyOn(sandboxId: string): Promise<string | null> {
    const found = await this.sandboxes.find(SandboxId.of(sandboxId));

    return found?.isReady && found.hostId ? found.hostId.value : null;
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

  async reconcile(
    host: string,
    reported: readonly string[],
    at: Date,
    stopping: boolean,
  ): Promise<readonly string[]> {
    const hostId = HostId.of(host);
    const known = await this.sandboxes.liveOn(hostId);
    const reporting = new Set(reported);
    const drain = new Set(reported);

    for (const live of known) {
      const changed = await reviseSandbox(this.sandboxes, live, (sandbox) =>
        !reporting.has(sandbox.id.value)
          ? sandbox.unreported(at)
          : stopping
            ? sandbox.reported().drainedWhenIdle()
            : sandbox.reported(),
      );

      if (changed && !changed.mustDrain) {
        drain.delete(changed.id.value);
      }
    }

    return [...drain].sort();
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

    for (const stranded of await this.sandboxes.liveOnHostsSilentSince(
      RunnerHost.onlineCutoff(now),
    )) {
      await reviseSandbox(this.sandboxes, stranded, (sandbox) =>
        sandbox.lost(now),
      );
    }

    await this.sandboxes.removeGoneBefore(Sandbox.goneBefore(now));
  }
}

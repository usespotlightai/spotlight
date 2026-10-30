import type {
  SandboxesPort,
  SandboxForRun,
} from '@runners/application/ports/sandboxes.port';
import { reviseSandbox } from '@runners/application/services/sandbox-revisions';
import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import { SandboxVersionConflictError } from '@runners/domain/exceptions/sandbox-version-conflict.error';
import type { SandboxRepository } from '@runners/domain/repositories/sandbox.repository';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import type { SandboxDrainPolicy } from '@runners/domain/value-objects/sandbox-drain-policy.vo';
import { SandboxId } from '@runners/domain/value-objects/sandbox-id.vo';
import { SandboxKey } from '@runners/domain/value-objects/sandbox-key.vo';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const ATTEMPTS = 3;

export class Sandboxes implements SandboxesPort {
  readonly name = 'Draining idle sandboxes';

  constructor(
    private readonly sandboxes: SandboxRepository,
    private readonly policy: SandboxDrainPolicy,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
    private readonly logger: LoggerPort,
  ) {}

  async holdForRun(run: SandboxForRun, at: Date): Promise<string> {
    const workspaceId = WorkspaceId.of(run.workspaceId);
    const key = run.key === null ? null : SandboxKey.of(run.key);

    for (let attempt = 1; ; attempt++) {
      const started = Sandbox.startForRun({
        id: SandboxId.of(this.ids.generate()),
        workspaceId,
        key,
        hostId: HostId.of(run.hostId),
        runId: run.runId,
        at,
      });

      try {
        await this.transaction.inTransaction(async () => {
          const open = key
            ? await this.sandboxes.openFor(workspaceId, key)
            : null;

          if (open) {
            await this.sandboxes.save(open.drain());
          }

          await this.sandboxes.add(started);
        });

        return started.id.value;
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

  async releaseRun(runId: string, at: Date): Promise<void> {
    for (const holding of await this.sandboxes.holdingRun(runId)) {
      await reviseSandbox(this.sandboxes, holding, (sandbox) =>
        sandbox.releaseRun(runId, at),
      );
    }
  }

  async reconcile(
    host: string,
    reported: readonly string[],
    at: Date,
  ): Promise<readonly string[]> {
    const hostId = HostId.of(host);
    const known = await this.sandboxes.liveOn(hostId);
    const reporting = new Set(reported);
    const drain = new Set(reported);

    for (const live of known) {
      const changed = await reviseSandbox(this.sandboxes, live, (sandbox) =>
        reporting.has(sandbox.id.value)
          ? sandbox.reported()
          : sandbox.unreported(at),
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
          { sandboxId: idle.id.value, hostId: idle.hostId.value },
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

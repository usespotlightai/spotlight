import type { QueuedWorkPort } from '@runners/application/ports/queued-work.port';
import { HostOutage } from '@runners/domain/aggregates/host-outage.aggregate';
import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import { HostOutageVersionConflictError } from '@runners/domain/exceptions/host-outage-version-conflict.error';
import type { HostOutageRepository } from '@runners/domain/repositories/host-outage.repository';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import {
  HostOutages,
  type SourceOutage,
} from '@runners/domain/services/host-outages';
import type { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { HostOutageId } from '@runners/domain/value-objects/host-outage-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

// Raises an outage once the hosts of a pull pool or a trust all stop reporting in, and ends it once one of them reports in again. A worker calls it every minute.
export class WatchHostOutages {
  constructor(
    private readonly outages: HostOutageRepository,
    private readonly hosts: RunnerHostRepository,
    private readonly pools: RunnerPoolRepository,
    private readonly trusts: RunnerTrustRepository,
    private readonly queued: QueuedWorkPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async sweep(): Promise<void> {
    const now = this.clock.now();
    const open = await this.outages.all();
    const quiet = await this.hosts.silentSince(RunnerHost.onlineCutoff(now));
    const workspaces = new Map(
      [...open, ...quiet].map((each) => [
        each.workspaceId.value,
        each.workspaceId,
      ]),
    );

    for (const workspaceId of workspaces.values()) {
      await this.inWorkspace(
        workspaceId,
        open.filter((each) => each.workspaceId.equals(workspaceId)),
        now,
      );
    }
  }

  private async inWorkspace(
    workspaceId: WorkspaceId,
    open: readonly HostOutage[],
    now: Date,
  ): Promise<void> {
    const outages = HostOutages.ofSources(
      await this.hosts.inWorkspace(workspaceId),
      now,
    );

    for (const outage of open) {
      if (!outage.holdsAmong(outages)) {
        await this.ended(outage.end(now));
      }
    }

    const unraised = HostOutages.unraised(outages, open);

    if (unraised.length === 0) {
      return;
    }

    const workWaits = await this.queued.waitsIn(workspaceId, now);

    for (const outage of unraised) {
      if (HostOutages.tellsAPerson(outage, { workWaits, now })) {
        await this.raised(workspaceId, outage, now);
      }
    }
  }

  private async raised(
    workspaceId: WorkspaceId,
    outage: SourceOutage,
    now: Date,
  ): Promise<void> {
    try {
      await this.outages.add(
        HostOutage.raise({
          id: HostOutageId.of(this.ids.generate()),
          outage,
          workspaceId,
          sourceKey: await this.keyOf(outage.source),
          at: now,
        }),
      );
    } catch (error) {
      // Another sweep raised it first.
      if (!(error instanceof HostOutageVersionConflictError)) {
        throw error;
      }
    }
  }

  private async ended(outage: HostOutage): Promise<void> {
    try {
      await this.outages.remove(outage);
    } catch (error) {
      // Another sweep ended it first.
      if (!(error instanceof HostOutageVersionConflictError)) {
        throw error;
      }
    }
  }

  private async keyOf(source: CredentialSource): Promise<string | null> {
    const { poolId, trustId } = source;

    if (poolId) {
      return (await this.pools.find(poolId))?.key.value ?? null;
    }

    return trustId
      ? ((await this.trusts.find(trustId))?.key.value ?? null)
      : null;
  }
}

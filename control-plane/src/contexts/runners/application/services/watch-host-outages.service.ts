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
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

// What the sweep needs of a pull pool or a trust. Null once it is gone.
interface Source {
  readonly key: string;
  readonly labels: readonly string[];
}

// Raises an outage once the hosts of a pull pool or a trust all stop reporting in, and ends it once one of them reports in again or the source is gone. A worker calls it every minute.
export class WatchHostOutages {
  constructor(
    private readonly outages: HostOutageRepository,
    private readonly hosts: RunnerHostRepository,
    private readonly pools: RunnerPoolRepository,
    private readonly trusts: RunnerTrustRepository,
    private readonly queued: QueuedWorkPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async sweep(): Promise<void> {
    const now = this.clock.now();
    const open = await this.outages.all();

    for (const outage of open) {
      await this.logged({ outageId: outage.id.value }, () =>
        this.endedIfOver(outage, now),
      );
    }

    const quiet = await this.hosts.silentSince(RunnerHost.onlineCutoff(now));
    const workspaces = new Map(
      quiet.map((host) => [host.workspaceId.value, host.workspaceId]),
    );

    for (const workspaceId of workspaces.values()) {
      await this.logged({ workspaceId: workspaceId.value }, () =>
        this.raisedIn(
          workspaceId,
          open.filter((each) => each.workspaceId.equals(workspaceId)),
          now,
        ),
      );
    }
  }

  private async endedIfOver(outage: HostOutage, now: Date): Promise<void> {
    const over = outage.isOverWith({
      hosts: await this.hosts.servingThrough(outage.source),
      sourceExists: (await this.sourceOf(outage.source)) !== null,
      now,
    });

    if (!over) {
      return;
    }

    try {
      await this.outages.remove(outage.end(now));
    } catch (error) {
      // Another sweep ended it first.
      if (!(error instanceof HostOutageVersionConflictError)) {
        throw error;
      }
    }
  }

  private async raisedIn(
    workspaceId: WorkspaceId,
    open: readonly HostOutage[],
    now: Date,
  ): Promise<void> {
    const unraised = HostOutages.unraised(
      HostOutages.ofSources(await this.hosts.inWorkspace(workspaceId), now),
      open,
    );

    for (const outage of unraised) {
      const source = await this.sourceOf(outage.source);

      if (
        source &&
        HostOutages.tellsAPerson(outage, {
          workWaits: await this.queued.waitsFor(
            workspaceId,
            source.labels,
            now,
          ),
          now,
        })
      ) {
        await this.raised(workspaceId, outage, source, now);
      }
    }
  }

  private async raised(
    workspaceId: WorkspaceId,
    outage: SourceOutage,
    source: Source,
    now: Date,
  ): Promise<void> {
    try {
      await this.outages.add(
        HostOutage.raise({
          id: HostOutageId.of(this.ids.generate()),
          workspaceId,
          outage,
          sourceKey: source.key,
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

  private async sourceOf(source: CredentialSource): Promise<Source | null> {
    const { poolId, trustId } = source;
    const found = poolId
      ? await this.pools.find(poolId)
      : trustId
        ? await this.trusts.find(trustId)
        : null;

    return found && !found.isDeleted
      ? { key: found.key.value, labels: found.labels.values }
      : null;
  }

  // One outage or workspace that fails does not hold up the others.
  private async logged(
    about: Readonly<Record<string, string>>,
    work: () => Promise<void>,
  ): Promise<void> {
    try {
      await work();
    } catch (error) {
      this.logger.error({ ...about, err: error }, 'Watching a host outage');
    }
  }
}

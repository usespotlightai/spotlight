import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type {
  CredentialSourceSummary,
  HostSummary,
  LiveRunnerSummary,
  RunnerReaderPort,
} from '@runners/application/ports/runner-reader.port';
import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import { HostReport } from '@runners/domain/value-objects/host-report.vo';
import {
  runner,
  runnerHost,
  runnerPool,
  runnerTrust,
} from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, gt, isNotNull, isNull, ne, or } from 'drizzle-orm';

const sourceOf = (row: {
  poolId: string | null;
  poolKey: string | null;
  trustKey: string | null;
}): CredentialSourceSummary =>
  row.poolId !== null
    ? { kind: 'pool', key: row.poolKey }
    : { kind: 'trust', key: row.trustKey };

const PLATFORM = 'spotlight';

@Injectable()
export class DrizzleRunnerReader implements RunnerReaderPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly platform: boolean,
  ) {}

  async readyToRun(workspaceId: WorkspaceId): Promise<boolean> {
    const [pushed] = await this.db
      .select({ id: runnerPool.id })
      .from(runnerPool)
      .where(
        and(
          eq(runnerPool.workspaceId, workspaceId.value),
          isNotNull(runnerPool.provisionUrl),
        ),
      )
      .limit(1);

    if (pushed) {
      return true;
    }

    return this.hasEgressCapableRunner(workspaceId);
  }

  async hasEgressCapableRunner(workspaceId: WorkspaceId): Promise<boolean> {
    const [egressPool] = await this.db
      .select({ id: runnerPool.id })
      .from(runnerPool)
      .where(
        and(
          eq(runnerPool.workspaceId, workspaceId.value),
          isNotNull(runnerPool.provisionUrl),
          isNotNull(runnerPool.provisionEgress),
          this.platform ? undefined : ne(runnerPool.provisionEgress, PLATFORM),
        ),
      )
      .limit(1);

    if (egressPool) {
      return true;
    }

    const hosts = await this.db
      .select({
        name: runnerHost.name,
        release: runnerHost.release,
        containerRuntime: runnerHost.containerRuntime,
        capacity: runnerHost.capacity,
        running: runnerHost.running,
        images: runnerHost.images,
      })
      .from(runnerHost)
      .where(
        and(
          eq(runnerHost.workspaceId, workspaceId.value),
          gt(
            runnerHost.lastHeartbeatAt,
            RunnerHost.staleBefore(this.clock.now()),
          ),
        ),
      );

    return hosts.some((row) => HostReport.of(row).supportsAHarness);
  }

  async supportedModels(
    workspaceId: WorkspaceId,
  ): Promise<ReadonlyMap<string, readonly string[]>> {
    const now = this.clock.now();
    const hostsWithHeartbeatSince = RunnerHost.staleBefore(now);
    const runnersEndedSince = Runner.endedRetentionSince(now);
    const [hosts, runners] = await Promise.all([
      this.db
        .select({ images: runnerHost.images })
        .from(runnerHost)
        .where(
          and(
            eq(runnerHost.workspaceId, workspaceId.value),
            gt(runnerHost.lastHeartbeatAt, hostsWithHeartbeatSince),
          ),
        ),
      this.db
        .select({ supported: runner.supportedModels })
        .from(runner)
        .where(
          and(
            eq(runner.workspaceId, workspaceId.value),
            or(isNull(runner.endedAt), gt(runner.endedAt, runnersEndedSince)),
          ),
        ),
    ]);

    const byHarness = new Map<string, string[]>();
    const collect = (harness: string, models: readonly string[]) => {
      const known = byHarness.get(harness) ?? [];

      for (const model of models) {
        if (!known.includes(model)) {
          known.push(model);
        }
      }
      byHarness.set(harness, known);
    };

    for (const row of hosts) {
      for (const image of row.images.filter(
        (each) => !each.unavailableReason,
      )) {
        for (const each of image.harnesses) {
          collect(each.id, each.models);
        }
      }
    }
    for (const row of runners) {
      for (const [harness, models] of Object.entries(row.supported)) {
        collect(harness, models);
      }
    }

    return byHarness;
  }

  async inWorkspace(workspaceId: WorkspaceId): Promise<LiveRunnerSummary[]> {
    const rows = await this.db
      .select({
        id: runner.id,
        poolId: runner.poolId,
        poolKey: runnerPool.key,
        trustKey: runnerTrust.key,
        hostId: runner.hostId,
        image: runner.image,
        harnesses: runner.harnesses,
        startedAt: runner.startedAt,
        lastHeartbeatAt: runner.lastHeartbeatAt,
      })
      .from(runner)
      .leftJoin(runnerPool, eq(runnerPool.id, runner.poolId))
      .leftJoin(runnerTrust, eq(runnerTrust.id, runner.trustId))
      .where(
        and(
          eq(runner.workspaceId, workspaceId.value),
          isNull(runner.endedAt),
          isNotNull(runner.workId),
        ),
      )
      .orderBy(runner.startedAt);

    return rows.map((row) => ({
      id: row.id,
      source: sourceOf(row),
      hostId: row.hostId,
      image: row.image,
      harnesses: row.harnesses,
      startedAt: row.startedAt,
      lastHeartbeatAt: row.lastHeartbeatAt,
    }));
  }

  async hostsIn(workspaceId: WorkspaceId, since: Date): Promise<HostSummary[]> {
    const rows = await this.db
      .select({
        host: runnerHost,
        poolId: runnerHost.poolId,
        poolKey: runnerPool.key,
        trustKey: runnerTrust.key,
      })
      .from(runnerHost)
      .leftJoin(runnerPool, eq(runnerPool.id, runnerHost.poolId))
      .leftJoin(runnerTrust, eq(runnerTrust.id, runnerHost.trustId))
      .where(
        and(
          eq(runnerHost.workspaceId, workspaceId.value),
          gt(runnerHost.lastHeartbeatAt, since),
        ),
      )
      .orderBy(runnerHost.name);

    return rows.map(({ host, ...keys }) => ({
      id: host.id,
      name: host.name,
      source: sourceOf(keys),
      release: host.release,
      containerRuntime: host.containerRuntime,
      capacity: host.capacity,
      running: host.running,
      images: host.images.map((each) => ({
        image: each.image,
        digest: each.digest ?? null,
        isDefault: each.isDefault,
        release: each.release ?? null,
        harnesses: each.harnesses.map((harness) => ({
          id: harness.id,
          version: harness.version ?? null,
        })),
        unavailableReason: each.unavailableReason ?? null,
      })),
      firstHeartbeatAt: host.firstHeartbeatAt,
      onlineSince: host.onlineSince,
      lastHeartbeatAt: host.lastHeartbeatAt,
    }));
  }
}

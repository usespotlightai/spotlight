import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type {
  AdmittedThrough,
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

const through = (row: {
  poolId: string | null;
  poolKey: string | null;
  trustKey: string | null;
}): AdmittedThrough =>
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

    return this.hasAWayOut(workspaceId);
  }

  async hasAWayOut(workspaceId: WorkspaceId): Promise<boolean> {
    const [goingOut] = await this.db
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

    if (goingOut) {
      return true;
    }

    const hosts = await this.db
      .select({
        name: runnerHost.name,
        release: runnerHost.release,
        executor: runnerHost.executor,
        capacity: runnerHost.capacity,
        running: runnerHost.running,
        images: runnerHost.images,
      })
      .from(runnerHost)
      .where(
        and(
          eq(runnerHost.workspaceId, workspaceId.value),
          gt(
            runnerHost.lastSeenAt,
            RunnerHost.rememberedSince(this.clock.now()),
          ),
        ),
      );

    return hosts.some((row) => HostReport.of(row).servesAHarness);
  }

  async advertisedModels(
    workspaceId: WorkspaceId,
  ): Promise<ReadonlyMap<string, readonly string[]>> {
    const now = this.clock.now();
    const hostsSeenSince = RunnerHost.rememberedSince(now);
    const runnersEndedSince = Runner.rememberedEndingSince(now);
    const [hosts, runners] = await Promise.all([
      this.db
        .select({ images: runnerHost.images })
        .from(runnerHost)
        .where(
          and(
            eq(runnerHost.workspaceId, workspaceId.value),
            gt(runnerHost.lastSeenAt, hostsSeenSince),
          ),
        ),
      this.db
        .select({ advertised: runner.advertisedModels })
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
      for (const [harness, models] of Object.entries(row.advertised)) {
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
        lastSeenAt: runner.lastSeenAt,
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
      through: through(row),
      hostId: row.hostId,
      image: row.image,
      harnesses: row.harnesses,
      startedAt: row.startedAt,
      lastSeenAt: row.lastSeenAt,
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
          gt(runnerHost.lastSeenAt, since),
        ),
      )
      .orderBy(runnerHost.name);

    return rows.map(({ host, ...keys }) => ({
      id: host.id,
      name: host.name,
      through: through(keys),
      release: host.release,
      executor: host.executor,
      capacity: host.capacity,
      running: host.running,
      images: host.images.map((each) => ({
        image: each.image,
        digest: each.digest ?? null,
        usual: each.usual,
        release: each.release ?? null,
        harnesses: each.harnesses.map((harness) => ({
          id: harness.id,
          version: harness.version ?? null,
        })),
        unavailableReason: each.unavailableReason ?? null,
      })),
      firstSeenAt: host.firstSeenAt,
      upSince: host.upSince,
      lastSeenAt: host.lastSeenAt,
    }));
  }
}

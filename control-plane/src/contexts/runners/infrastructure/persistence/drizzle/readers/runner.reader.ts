import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type {
  AdmittedThrough,
  HostSummary,
  LiveRunnerSummary,
  RunnerReaderPort,
} from '@runners/application/ports/runner-reader.port';
import {
  runner,
  runnerHost,
  runnerPool,
  runnerTrust,
} from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, gt, isNotNull, isNull, or, sql } from 'drizzle-orm';

const RECENTLY = sql`now() - interval '1 day'`;

const through = (row: {
  poolId: string | null;
  poolKey: string | null;
  trustKey: string | null;
}): AdmittedThrough =>
  row.poolId !== null
    ? { kind: 'pool', key: row.poolKey }
    : { kind: 'trust', key: row.trustKey };

@Injectable()
export class DrizzleRunnerReader implements RunnerReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async anyOffersWork(workspaceId: WorkspaceId): Promise<boolean> {
    const [way] = await this.db
      .select({ id: runnerPool.id })
      .from(runnerPool)
      .where(eq(runnerPool.workspaceId, workspaceId.value))
      .union(
        this.db
          .select({ id: runnerTrust.id })
          .from(runnerTrust)
          .where(eq(runnerTrust.workspaceId, workspaceId.value)),
      )
      .limit(1);

    return way !== undefined;
  }

  async advertisedModels(
    workspaceId: WorkspaceId,
  ): Promise<ReadonlyMap<string, readonly string[]>> {
    const [hosts, runners] = await Promise.all([
      this.db
        .select({ harnesses: runnerHost.harnesses })
        .from(runnerHost)
        .where(
          and(
            eq(runnerHost.workspaceId, workspaceId.value),
            gt(runnerHost.lastSeenAt, RECENTLY),
          ),
        ),
      this.db
        .select({ advertised: runner.advertisedModels })
        .from(runner)
        .where(
          and(
            eq(runner.workspaceId, workspaceId.value),
            or(isNull(runner.endedAt), gt(runner.endedAt, RECENTLY)),
          ),
        ),
    ]);

    const byHarness = new Map<string, string[]>();
    const hold = (harness: string, models: readonly string[]) => {
      const held = byHarness.get(harness) ?? [];

      for (const model of models) {
        if (!held.includes(model)) {
          held.push(model);
        }
      }
      byHarness.set(harness, held);
    };

    for (const row of hosts) {
      for (const each of row.harnesses) {
        hold(each.id, each.models);
      }
    }
    for (const row of runners) {
      for (const [harness, models] of Object.entries(row.advertised)) {
        hold(harness, models);
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
      harnesses: [...new Set(host.harnesses.map((each) => each.id))],
      firstSeenAt: host.firstSeenAt,
      lastSeenAt: host.lastSeenAt,
    }));
  }
}

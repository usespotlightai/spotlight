import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { IdleWorkingCopiesPort } from '@runners/application/ports/idle-working-copies.port';
import type { PlatformSetup } from '@runners/application/ports/platform-setup.port';
import type {
  CredentialSourceSummary,
  HostSummary,
  IdleSandboxSummary,
  LiveRunnerSummary,
  RunnerReaderPort,
} from '@runners/application/ports/runner-reader.port';
import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { Sandbox } from '@runners/domain/aggregates/sandbox.aggregate';
import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import { isIdleSandbox } from '@runners/infrastructure/persistence/drizzle/idle-sandboxes';
import {
  runner,
  runnerHost,
  runnerPool,
  runnerTrust,
  sandbox,
} from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, gt, inArray, isNotNull, isNull, or } from 'drizzle-orm';

interface SourceRow {
  readonly poolId: string | null;
  readonly poolKey: string | null;
  readonly poolPlatform: boolean | null;
  readonly poolEgress: string | null;
  readonly trustKey: string | null;
}


@Injectable()
export class DrizzleRunnerReader
  implements RunnerReaderPort, IdleWorkingCopiesPort
{
  private readonly platform: boolean;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(CLOCK) private readonly clock: ClockPort,
    setup: Pick<PlatformSetup, 'platformEgressSet'>,
  ) {
    this.platform = setup.platformEgressSet;
  }

  private sourceOf(row: SourceRow): CredentialSourceSummary {
    if (row.poolId === null) {
      return { kind: 'trust', key: row.trustKey };
    }

    return {
      kind: 'pool',
      key: row.poolKey,
      platform: row.poolPlatform
        ? {
            egress:
              row.poolEgress !== null &&
              EgressReference.of(row.poolEgress).usableWith(this.platform),
          }
        : null,
    };
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
        poolPlatform: runnerPool.platform,
        poolEgress: runnerPool.provisionEgress,
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
        ),
      )
      .orderBy(runner.startedAt);

    return rows.map((row) => ({
      id: row.id,
      source: this.sourceOf(row),
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
        poolPlatform: runnerPool.platform,
        poolEgress: runnerPool.provisionEgress,
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
      source: this.sourceOf(keys),
      release: host.release,
      containerRuntime: host.containerRuntime,
      capacity: host.capacity,
      reportedSandboxes: host.sandboxes,
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

  async idleSandboxesOn(
    hostIds: readonly string[],
  ): Promise<IdleSandboxSummary[]> {
    if (hostIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select({
        id: sandbox.id,
        hostId: sandbox.hostId,
        key: sandbox.key,
        warm: sandbox.warm,
        state: sandbox.state,
        idleSince: sandbox.idleSince,
        startedAt: sandbox.startedAt,
      })
      .from(sandbox)
      .where(
        and(inArray(sandbox.hostId, [...hostIds]), isIdleSandbox()),
      )
      .orderBy(sandbox.startedAt);

    return rows.flatMap((row) =>
      row.hostId !== null && Sandbox.isIdleAndLive(row)
        ? [
            {
              id: row.id,
              hostId: row.hostId,
              key: row.key,
              warmLineId: row.warm?.lineId ?? null,
              warmImage: row.warm?.image ?? null,
              state: row.state,
              idleSince: row.idleSince,
              startedAt: row.startedAt,
            },
          ]
        : [],
    );
  }

  async idleIn(workspaceId: WorkspaceId): Promise<readonly string[]> {
    const rows = await this.db
      .selectDistinct({ key: sandbox.key })
      .from(sandbox)
      .where(
        and(
          eq(sandbox.workspaceId, workspaceId.value),
          isNotNull(sandbox.hostId),
          isNotNull(sandbox.key),
          isIdleSandbox(),
        ),
      );

    return rows.flatMap((row) => (row.key === null ? [] : [row.key]));
  }
}

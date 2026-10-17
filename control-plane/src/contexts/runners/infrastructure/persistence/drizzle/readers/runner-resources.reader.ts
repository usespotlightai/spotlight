import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type {
  EgressRecord,
  RunnerPoolRecord,
  RunnerResourcesPort,
  RunnerTrustRecord,
  WorkspaceRunnersRecord,
} from '@runners/application/ports/runner-resources.port';
import type { WaysIn } from '@runners/domain/services/runner-drift';
import {
  egress,
  runnerPool,
  runnerTrust,
  workspaceRunners,
} from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, isNotNull } from 'drizzle-orm';

type TrustRow = typeof runnerTrust.$inferSelect;
type DeclaredRow = typeof workspaceRunners.$inferSelect;
type PoolRow = typeof runnerPool.$inferSelect;
type EgressRow = typeof egress.$inferSelect;

const poolRecord = (row: PoolRow): RunnerPoolRecord => ({
  id: row.id,
  version: row.version,
  workspaceId: WorkspaceId.of(row.workspaceId),
  key: row.key,
  labels: row.labels,
  maxRuns: row.maxRuns,
  tokenVersion: row.provisionUrl ? null : row.tokenVersion,
  provision: row.provisionUrl
    ? {
        url: row.provisionUrl,
        secretVersion: row.provisionSecretVersion,
        egress: row.provisionEgress,
        egressTraffic: row.provisionEgressTraffic === 'bound' ? 'bound' : 'all',
      }
    : null,
});

const egressRecord = (row: EgressRow): EgressRecord => ({
  id: row.id,
  version: row.version,
  workspaceId: WorkspaceId.of(row.workspaceId),
  key: row.key,
  url: row.url,
  tokenVersion: row.tokenVersion,
});

const trustRecord = (row: TrustRow): RunnerTrustRecord => ({
  id: row.id,
  version: row.version,
  workspaceId: WorkspaceId.of(row.workspaceId),
  key: row.key,
  issuer: row.issuer,
  subject: row.subject,
  audience: row.audience,
  labels: row.labels,
});

const declaredRecord = (row: DeclaredRow): WorkspaceRunnersRecord => ({
  id: row.id,
  version: row.version,
  workspaceId: WorkspaceId.of(row.workspaceId),
  trusts: row.trusts,
  pools: row.pools,
});

@Injectable()
export class DrizzleRunnerResources implements RunnerResourcesPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async trustWithId(id: string): Promise<RunnerTrustRecord | null> {
    const [found] = await this.db
      .select()
      .from(runnerTrust)
      .where(eq(runnerTrust.id, id))
      .limit(1);

    return found ? trustRecord(found) : null;
  }

  async trustAt(
    workspaceId: WorkspaceId,
    key: string,
  ): Promise<RunnerTrustRecord | null> {
    const [found] = await this.db
      .select()
      .from(runnerTrust)
      .where(
        and(
          eq(runnerTrust.workspaceId, workspaceId.value),
          eq(runnerTrust.key, key),
        ),
      )
      .limit(1);

    return found ? trustRecord(found) : null;
  }

  async trustsIn(
    workspaceId: WorkspaceId,
  ): Promise<readonly RunnerTrustRecord[]> {
    return (
      await this.db
        .select()
        .from(runnerTrust)
        .where(eq(runnerTrust.workspaceId, workspaceId.value))
    ).map(trustRecord);
  }

  async poolWithId(id: string): Promise<RunnerPoolRecord | null> {
    const [found] = await this.db
      .select()
      .from(runnerPool)
      .where(eq(runnerPool.id, id))
      .limit(1);

    return found ? poolRecord(found) : null;
  }

  async poolAt(
    workspaceId: WorkspaceId,
    key: string,
  ): Promise<RunnerPoolRecord | null> {
    const [found] = await this.db
      .select()
      .from(runnerPool)
      .where(
        and(
          eq(runnerPool.workspaceId, workspaceId.value),
          eq(runnerPool.key, key),
        ),
      )
      .limit(1);

    return found ? poolRecord(found) : null;
  }

  async poolsIn(
    workspaceId: WorkspaceId,
  ): Promise<readonly RunnerPoolRecord[]> {
    return (
      await this.db
        .select()
        .from(runnerPool)
        .where(eq(runnerPool.workspaceId, workspaceId.value))
    ).map(poolRecord);
  }

  async provisioningPools(): Promise<readonly RunnerPoolRecord[]> {
    return (
      await this.db
        .select()
        .from(runnerPool)
        .where(isNotNull(runnerPool.provisionUrl))
    ).map(poolRecord);
  }

  async egressWithId(id: string): Promise<EgressRecord | null> {
    const [found] = await this.db
      .select()
      .from(egress)
      .where(eq(egress.id, id))
      .limit(1);

    return found ? egressRecord(found) : null;
  }

  async egressAt(
    workspaceId: WorkspaceId,
    key: string,
  ): Promise<EgressRecord | null> {
    const [found] = await this.db
      .select()
      .from(egress)
      .where(
        and(eq(egress.workspaceId, workspaceId.value), eq(egress.key, key)),
      )
      .limit(1);

    return found ? egressRecord(found) : null;
  }

  async egressesIn(workspaceId: WorkspaceId): Promise<readonly EgressRecord[]> {
    return (
      await this.db
        .select()
        .from(egress)
        .where(eq(egress.workspaceId, workspaceId.value))
    ).map(egressRecord);
  }

  async declaredWithId(id: string): Promise<WorkspaceRunnersRecord | null> {
    const [found] = await this.db
      .select()
      .from(workspaceRunners)
      .where(eq(workspaceRunners.id, id))
      .limit(1);

    return found ? declaredRecord(found) : null;
  }

  async declaredIn(
    workspaceId: WorkspaceId,
  ): Promise<WorkspaceRunnersRecord | null> {
    const [found] = await this.db
      .select()
      .from(workspaceRunners)
      .where(eq(workspaceRunners.workspaceId, workspaceId.value))
      .limit(1);

    return found ? declaredRecord(found) : null;
  }

  async waysIn(workspaceId: WorkspaceId): Promise<WaysIn> {
    const [trusts, pools] = await Promise.all([
      this.db
        .select({ key: runnerTrust.key })
        .from(runnerTrust)
        .where(eq(runnerTrust.workspaceId, workspaceId.value)),
      this.db
        .select({ key: runnerPool.key })
        .from(runnerPool)
        .where(eq(runnerPool.workspaceId, workspaceId.value)),
    ]);

    return {
      trusts: trusts.map((each) => each.key),
      pools: pools.map((each) => each.key),
    };
  }
}

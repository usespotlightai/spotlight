import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type {
  KeptPool,
  KeptTrust,
  KeptWorkspaceRunners,
  RunnerResourcesPort,
} from '@runners/application/ports/runner-resources.port';
import type { WaysIn } from '@runners/domain/services/runner-drift';
import {
  runnerPool,
  runnerTrust,
  workspaceRunners,
} from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, isNotNull } from 'drizzle-orm';

type TrustRow = typeof runnerTrust.$inferSelect;
type DeclaredRow = typeof workspaceRunners.$inferSelect;
type PoolRow = typeof runnerPool.$inferSelect;

const keptPool = (row: PoolRow): KeptPool => ({
  id: row.id,
  version: row.version,
  workspaceId: WorkspaceId.of(row.workspaceId),
  key: row.key,
  labels: row.labels,
  maxRuns: row.maxRuns,
  tokenVersion: row.provisionUrl ? null : row.tokenVersion,
  provision: row.provisionUrl
    ? { url: row.provisionUrl, secretVersion: row.provisionSecretVersion }
    : null,
});

const keptTrust = (row: TrustRow): KeptTrust => ({
  id: row.id,
  version: row.version,
  workspaceId: WorkspaceId.of(row.workspaceId),
  key: row.key,
  issuer: row.issuer,
  subject: row.subject,
  audience: row.audience,
  labels: row.labels,
});

const keptDeclared = (row: DeclaredRow): KeptWorkspaceRunners => ({
  id: row.id,
  version: row.version,
  workspaceId: WorkspaceId.of(row.workspaceId),
  trusts: row.trusts,
  pools: row.pools,
});

@Injectable()
export class DrizzleRunnerResources implements RunnerResourcesPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async trustWithId(id: string): Promise<KeptTrust | null> {
    const [found] = await this.db
      .select()
      .from(runnerTrust)
      .where(eq(runnerTrust.id, id))
      .limit(1);

    return found ? keptTrust(found) : null;
  }

  async trustAt(
    workspaceId: WorkspaceId,
    key: string,
  ): Promise<KeptTrust | null> {
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

    return found ? keptTrust(found) : null;
  }

  async trustsIn(workspaceId: WorkspaceId): Promise<readonly KeptTrust[]> {
    return (
      await this.db
        .select()
        .from(runnerTrust)
        .where(eq(runnerTrust.workspaceId, workspaceId.value))
    ).map(keptTrust);
  }

  async poolWithId(id: string): Promise<KeptPool | null> {
    const [found] = await this.db
      .select()
      .from(runnerPool)
      .where(eq(runnerPool.id, id))
      .limit(1);

    return found ? keptPool(found) : null;
  }

  async poolAt(
    workspaceId: WorkspaceId,
    key: string,
  ): Promise<KeptPool | null> {
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

    return found ? keptPool(found) : null;
  }

  async poolsIn(workspaceId: WorkspaceId): Promise<readonly KeptPool[]> {
    return (
      await this.db
        .select()
        .from(runnerPool)
        .where(eq(runnerPool.workspaceId, workspaceId.value))
    ).map(keptPool);
  }

  async provisioningPools(): Promise<readonly KeptPool[]> {
    return (
      await this.db
        .select()
        .from(runnerPool)
        .where(isNotNull(runnerPool.provisionUrl))
    ).map(keptPool);
  }

  async declaredWithId(id: string): Promise<KeptWorkspaceRunners | null> {
    const [found] = await this.db
      .select()
      .from(workspaceRunners)
      .where(eq(workspaceRunners.id, id))
      .limit(1);

    return found ? keptDeclared(found) : null;
  }

  async declaredIn(
    workspaceId: WorkspaceId,
  ): Promise<KeptWorkspaceRunners | null> {
    const [found] = await this.db
      .select()
      .from(workspaceRunners)
      .where(eq(workspaceRunners.workspaceId, workspaceId.value))
      .limit(1);

    return found ? keptDeclared(found) : null;
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

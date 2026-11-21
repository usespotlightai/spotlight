import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import { PoolTokenInUseError } from '@runners/domain/exceptions/pool-token-in-use.error';
import { RunnerPoolAlreadyExistsError } from '@runners/domain/exceptions/runner-pool-already-exists.error';
import { RunnerPoolVersionConflictError } from '@runners/domain/exceptions/runner-pool-version-conflict.error';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import { EgressTraffic } from '@runners/domain/value-objects/egress-traffic.vo';
import { EncryptedProvisionSecret } from '@runners/domain/value-objects/encrypted-provision-secret.vo';
import { MaxRuns } from '@runners/domain/value-objects/max-runs.vo';
import {
  PlatformAccess,
  type PoolAccess,
  PullAccess,
  PushAccess,
} from '@runners/domain/value-objects/pool-access.vo';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import { RotationVersion } from '@runners/domain/value-objects/rotation-version.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { runnerPool } from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ownedPools } from '@runners/infrastructure/persistence/drizzle/owned-pools';
import { and, eq, inArray, type SQL } from 'drizzle-orm';

type Row = typeof runnerPool.$inferSelect;

const written = (pool: RunnerPool) => {
  const { access } = pool;
  const pushed = access.kind === 'push' ? access : null;

  return {
    key: pool.key.value,
    labels: [...pool.labels.values],
    maxRuns: pool.maxRuns?.value ?? null,
    tokenHash: access.mode === 'pull' ? access.tokenHash.value : null,
    tokenVersion: access.mode === 'pull' ? access.tokenVersion.value : null,
    provisionUrl: pushed?.url.value ?? null,
    provisionSecret: pushed?.secret.value ?? null,
    provisionSecretVersion: pushed?.secretVersion.value ?? null,
    provisionEgress:
      access.mode === 'push' ? (access.egress?.value ?? null) : null,
    provisionEgressTraffic:
      access.mode === 'push' && access.egress
        ? access.egressTraffic.value
        : null,
    platform: access.kind === 'platform',
    disabled: pool.isDisabled,
  };
};

const egressOf = (row: Row): EgressReference | null =>
  row.provisionEgress === null ? null : EgressReference.of(row.provisionEgress);

const accessOf = (row: Row): PoolAccess => {
  if (row.platform) {
    return PlatformAccess.of(egressOf(row));
  }

  if (row.tokenHash) {
    return PullAccess.of(
      TokenHash.of(row.tokenHash),
      RotationVersion.of(row.tokenVersion),
    );
  }

  if (row.provisionUrl && row.provisionSecret) {
    return PushAccess.of(
      ProvisionUrl.of(row.provisionUrl),
      EncryptedProvisionSecret.of(row.provisionSecret),
      RotationVersion.of(row.provisionSecretVersion),
      egressOf(row),
      row.provisionEgressTraffic === 'bound'
        ? EgressTraffic.of('bound')
        : EgressTraffic.all(),
    );
  }

  throw new InconsistentStateError(
    'runner pool',
    'is neither pulled from nor provisioning',
  );
};

const toPool = (row: Row): RunnerPool =>
  RunnerPool.rehydrate({
    id: PoolId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    key: PoolKey.of(row.key),
    labels: RunnerLabels.of(row.labels),
    maxRuns: row.maxRuns === null ? null : MaxRuns.of(row.maxRuns),
    access: accessOf(row),
    disabled: row.disabled,
    version: row.version,
  });

const domainErrorOf = (error: unknown, key: string): unknown => {
  if (violates(error, UNIQUE_VIOLATION, 'runner_pool_workspace_key')) {
    return new RunnerPoolAlreadyExistsError(key);
  }

  if (violates(error, UNIQUE_VIOLATION, 'runner_pool_token_hash')) {
    return new PoolTokenInUseError();
  }

  return error;
};

@Injectable()
export class DrizzleRunnerPoolRepository implements RunnerPoolRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: RunnerPool): Promise<void> {
    await this.context.inTransaction(async () => {
      try {
        await this.context.db.insert(runnerPool).values({
          id: added.id.value,
          workspaceId: added.workspaceId.value,
          ...written(added),
          version: added.version,
        });
      } catch (error) {
        throw domainErrorOf(error, added.key.value);
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: RunnerPool): Promise<void> {
    await this.context.inTransaction(async () => {
      const matching = and(
        eq(runnerPool.id, saved.id.value),
        eq(runnerPool.version, saved.version),
      );
      const stored = !saved.isDeleted
        ? await this.context.db
            .update(runnerPool)
            .set({ ...written(saved), version: saved.version + 1 })
            .where(matching)
            .returning({ id: runnerPool.id })
            .catch((error: unknown) => {
              throw domainErrorOf(error, saved.key.value);
            })
        : await this.context.db
            .delete(runnerPool)
            .where(matching)
            .returning({ id: runnerPool.id });

      if (stored.length === 0) {
        throw new RunnerPoolVersionConflictError(saved.id.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  find(id: PoolId): Promise<RunnerPool | null> {
    return this.one(eq(runnerPool.id, id.value), { locked: false });
  }

  findForStart(id: PoolId): Promise<RunnerPool | null> {
    return this.one(eq(runnerPool.id, id.value), { locked: true });
  }

  findByTokenHash(hash: TokenHash): Promise<RunnerPool | null> {
    return this.one(eq(runnerPool.tokenHash, hash.value), { locked: false });
  }

  async inWorkspace(workspaceId: WorkspaceId): Promise<readonly RunnerPool[]> {
    const rows = await this.context.db
      .select()
      .from(runnerPool)
      .where(eq(runnerPool.workspaceId, workspaceId.value));

    return rows.map(toPool);
  }

  findAllByWorkspaces(
    workspaceIds: readonly WorkspaceId[],
  ): Promise<readonly RunnerPool[]> {
    return workspaceIds.length === 0
      ? Promise.resolve([])
      : this.all(
          inArray(
            runnerPool.workspaceId,
            workspaceIds.map((each) => each.value),
          ),
        );
  }

  findAllByKey(key: PoolKey): Promise<readonly RunnerPool[]> {
    return this.all(eq(runnerPool.key, key.value));
  }

  findOwned(id: PoolId): Promise<RunnerPool | null> {
    return this.one(and(eq(runnerPool.id, id.value), ownedPools) as SQL, {
      locked: false,
    });
  }

  listOwned(workspaceId: WorkspaceId): Promise<readonly RunnerPool[]> {
    return this.all(
      and(eq(runnerPool.workspaceId, workspaceId.value), ownedPools) as SQL,
    );
  }

  private async all(where: SQL): Promise<readonly RunnerPool[]> {
    const rows = await this.context.db.select().from(runnerPool).where(where);

    return rows.map(toPool);
  }

  private async one(
    where: SQL,
    { locked }: { locked: boolean },
  ): Promise<RunnerPool | null> {
    const chosen = this.context.db
      .select()
      .from(runnerPool)
      .where(where)
      .limit(1);
    const [found] = locked ? await chosen.for('update') : await chosen;

    return found ? toPool(found) : null;
  }
}

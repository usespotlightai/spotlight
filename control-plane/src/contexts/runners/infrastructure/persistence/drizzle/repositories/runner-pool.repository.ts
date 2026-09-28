import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import { PoolTokenTakenError } from '@runners/domain/exceptions/pool-token-taken.error';
import { RunnerPoolAlreadyDefinedError } from '@runners/domain/exceptions/runner-pool-already-defined.error';
import { RunnerPoolMovedOnError } from '@runners/domain/exceptions/runner-pool-moved-on.error';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import { MaxRuns } from '@runners/domain/value-objects/max-runs.vo';
import {
  type PoolAccess,
  PullAccess,
  PushAccess,
} from '@runners/domain/value-objects/pool-access.vo';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { SealedProvisionSecret } from '@runners/domain/value-objects/sealed-provision-secret.vo';
import { runnerPool } from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, type SQL } from 'drizzle-orm';

type Row = typeof runnerPool.$inferSelect;

const written = (pool: RunnerPool) => {
  const { access } = pool;

  return {
    key: pool.key.value,
    labels: [...pool.labels.values],
    maxRuns: pool.maxRuns?.value ?? null,
    tokenHash: access.mode === 'pull' ? access.tokenHash.value : null,
    tokenVersion: access.mode === 'pull' ? access.tokenVersion : null,
    provisionUrl: access.mode === 'push' ? access.url.value : null,
    provisionSecret: access.mode === 'push' ? access.secret.value : null,
    provisionSecretVersion:
      access.mode === 'push' ? access.secretVersion : null,
  };
};

const accessOf = (row: Row): PoolAccess => {
  if (row.tokenHash) {
    return PullAccess.of(TokenHash.of(row.tokenHash), row.tokenVersion);
  }

  if (row.provisionUrl && row.provisionSecret) {
    return PushAccess.of(
      ProvisionUrl.of(row.provisionUrl),
      SealedProvisionSecret.of(row.provisionSecret),
      row.provisionSecretVersion,
    );
  }

  throw new InconsistentStateError(
    'runner pool',
    'was kept neither pulled from nor provisioning',
  );
};

const toPool = (row: Row): RunnerPool =>
  RunnerPool.rehydrate({
    id: RunnerPoolId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    key: PoolKey.of(row.key),
    labels: RunnerLabels.of(row.labels),
    maxRuns: row.maxRuns === null ? null : MaxRuns.of(row.maxRuns),
    access: accessOf(row),
    version: row.version,
  });

const refusedAs = (error: unknown, key: string): unknown => {
  if (violates(error, UNIQUE_VIOLATION, 'runner_pool_workspace_key')) {
    return new RunnerPoolAlreadyDefinedError(key);
  }

  if (violates(error, UNIQUE_VIOLATION, 'runner_pool_token_hash')) {
    return new PoolTokenTakenError();
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
    await this.context.run(async () => {
      try {
        await this.context.db.insert(runnerPool).values({
          id: added.id.value,
          workspaceId: added.workspaceId.value,
          ...written(added),
          version: added.version,
        });
      } catch (error) {
        throw refusedAs(error, added.key.value);
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: RunnerPool): Promise<void> {
    await this.context.run(async () => {
      const matching = and(
        eq(runnerPool.id, saved.id.value),
        eq(runnerPool.version, saved.version),
      );
      const stored = !saved.isRetired
        ? await this.context.db
            .update(runnerPool)
            .set({ ...written(saved), version: saved.version + 1 })
            .where(matching)
            .returning({ id: runnerPool.id })
            .catch((error: unknown) => {
              throw refusedAs(error, saved.key.value);
            })
        : await this.context.db
            .delete(runnerPool)
            .where(matching)
            .returning({ id: runnerPool.id });

      if (stored.length === 0) {
        throw new RunnerPoolMovedOnError(saved.id.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  find(id: RunnerPoolId): Promise<RunnerPool | null> {
    return this.one(eq(runnerPool.id, id.value), { locked: false });
  }

  findForStart(id: RunnerPoolId): Promise<RunnerPool | null> {
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

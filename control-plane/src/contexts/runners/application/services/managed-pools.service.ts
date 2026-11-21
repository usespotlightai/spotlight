import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { ManagedPoolChangeDto } from '@runners/application/dto/managed-pool.dto';
import type { ManagedPoolSettings } from '@runners/application/ports/managed-pool-settings.port';
import { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import { RunnerPoolAlreadyExistsError } from '@runners/domain/exceptions/runner-pool-already-exists.error';
import { RunnerPoolVersionConflictError } from '@runners/domain/exceptions/runner-pool-version-conflict.error';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const lostRace = (error: unknown): boolean =>
  error instanceof RunnerPoolAlreadyExistsError ||
  error instanceof RunnerPoolVersionConflictError;

// Keeps one managed pool in each workspace while the deployment sets a managed provisioner. While it sets none, only the disabled managed pools stay. Another instance can do the same work at the same time, so each step accepts that it lost a race.
export class ManagedPools {
  constructor(
    private readonly pools: RunnerPoolRepository,
    private readonly workspaces: WorkspaceReaderPort,
    private readonly settings: ManagedPoolSettings | null,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
    private readonly logger: LoggerPort,
  ) {}

  async reconcile(): Promise<void> {
    const keyed = await this.pools.withKey(PoolKey.managed());

    if (!this.settings) {
      await this.removeAll(keyed);
      return;
    }

    const settings = this.settings;
    const found = new Map(keyed.map((each) => [each.workspaceId.value, each]));

    for (const workspaceId of await this.workspaces.openIds()) {
      const pool = found.get(workspaceId.value);

      await this.step(workspaceId, () =>
        pool
          ? this.reconciled(pool, settings)
          : this.created(workspaceId, settings),
      );
    }
  }

  async createFor(workspaceId: WorkspaceId): Promise<void> {
    // The event can arrive after the workspace is deleted.
    if (!this.settings || !(await this.workspaces.isOpen(workspaceId))) {
      return;
    }

    const pool = await this.managedKeyHolder(workspaceId);

    try {
      await (pool
        ? this.reconciled(pool, this.settings)
        : this.created(workspaceId, this.settings));
    } catch (error) {
      if (!lostRace(error)) {
        throw error;
      }
    }
  }

  // Turns the managed pool of one workspace off or on. It stays so across restarts.
  async update(
    workspaceId: WorkspaceId,
    disabled: boolean,
    by: ChangeActor,
  ): Promise<ManagedPoolChangeDto | null> {
    if (!this.settings) {
      return { outcome: 'off' };
    }

    if (!(await this.workspaces.isOpen(workspaceId))) {
      return null;
    }

    const found = await this.managedKeyHolder(workspaceId);

    if (found && !found.isManaged) {
      return { outcome: 'owned' };
    }

    const pool =
      found ??
      RunnerPool.createManaged({
        id: PoolId.of(this.ids.generate()),
        workspaceId,
        labels: this.settings.labels,
        egress: this.settings.egress,
        by,
      });
    const changed = disabled ? pool.disable(by) : pool.enable(by);

    await this.transaction.inTransaction(() =>
      found ? this.pools.save(changed) : this.pools.add(changed),
    );

    return { outcome: 'updated', disabled: changed.isDisabled };
  }

  private async managedKeyHolder(
    workspaceId: WorkspaceId,
  ): Promise<RunnerPool | null> {
    return (
      (await this.pools.inWorkspace(workspaceId)).find((each) =>
        each.key.equals(PoolKey.managed()),
      ) ?? null
    );
  }

  private async created(
    workspaceId: WorkspaceId,
    settings: ManagedPoolSettings,
  ): Promise<void> {
    const pool = RunnerPool.createManaged({
      id: PoolId.of(this.ids.generate()),
      workspaceId,
      labels: settings.labels,
      egress: settings.egress,
      by: ChangeActor.spotlight(workspaceId),
    });

    await this.transaction.inTransaction(() => this.pools.add(pool));
    this.logger.info(
      { workspaceId: workspaceId.value, pool: pool.id.value },
      'Added the managed runner pool to a workspace',
    );
  }

  private async reconciled(
    pool: RunnerPool,
    settings: ManagedPoolSettings,
  ): Promise<void> {
    if (!pool.isManaged) {
      this.logger.info(
        { workspaceId: pool.workspaceId.value, pool: pool.id.value },
        `Did not add the managed runner pool, because the workspace has its own pool ${pool.key.value}`,
      );
      return;
    }

    const changed = pool.reconcile(
      settings,
      ChangeActor.spotlight(pool.workspaceId),
    );

    if (changed !== pool) {
      await this.transaction.inTransaction(() => this.pools.save(changed));
    }
  }

  // A disabled managed pool provisions nothing, and it keeps the choice of the operator until the managed provisioner is set again.
  private async removeAll(keyed: readonly RunnerPool[]): Promise<void> {
    for (const pool of keyed) {
      if (pool.isManaged && !pool.isDisabled) {
        await this.step(pool.workspaceId, () =>
          this.transaction.inTransaction(() =>
            this.pools.save(
              pool.delete(ChangeActor.spotlight(pool.workspaceId)),
            ),
          ),
        );
      }
    }
  }

  private async step(
    workspaceId: WorkspaceId,
    work: () => Promise<void>,
  ): Promise<void> {
    try {
      await work();
    } catch (error) {
      if (lostRace(error)) {
        return;
      }

      this.logger.warn(
        { err: error, workspaceId: workspaceId.value },
        'Could not reconcile the managed runner pool of a workspace',
      );
    }
  }
}

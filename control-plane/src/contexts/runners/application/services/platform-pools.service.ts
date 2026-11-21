import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { PlatformPoolChangeDto } from '@runners/application/dto/platform-pool.dto';
import type { PlatformPoolSettings } from '@runners/application/ports/platform-pool-settings.port';
import { RunnerPool } from '@runners/domain/aggregates/runner-pool.aggregate';
import { RunnerPoolAlreadyExistsError } from '@runners/domain/exceptions/runner-pool-already-exists.error';
import { RunnerPoolVersionConflictError } from '@runners/domain/exceptions/runner-pool-version-conflict.error';
import type { RunnerPoolRepository } from '@runners/domain/repositories/runner-pool.repository';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const lostRace = (error: unknown): boolean =>
  error instanceof RunnerPoolAlreadyExistsError ||
  error instanceof RunnerPoolVersionConflictError;

// Keeps one platform pool in each workspace while the deployment sets the platform provisioner. While it sets none, only the disabled platform pools stay. Another instance can do the same work at the same time, so each step accepts that it lost a race. Spotlight is the actor of each change, except a change that the operator asks for.
export class PlatformPools {
  constructor(
    private readonly pools: RunnerPoolRepository,
    private readonly workspaces: WorkspaceReaderPort,
    private readonly settings: PlatformPoolSettings | null,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
    private readonly logger: LoggerPort,
  ) {}

  // Each instance walks every workspace, one at a time, at each start. That is one read of the pools and one write for each workspace that changes.
  async reconcile(): Promise<void> {
    // The pools are read before the workspaces, so that the platform pool of a workspace created in between is not taken for one of a deleted workspace.
    const keyed = await this.pools.withKey(PoolKey.platform());
    const open = await this.workspaces.openIds();
    const opened = new Set(open.map((each) => each.value));
    const platform = keyed.filter((each) => each.isPlatform);

    // A platform pool can outlive its workspace, when the workspace is deleted while Spotlight adds the pool.
    await this.deleteEach(
      platform.filter((each) => !opened.has(each.workspaceId.value)),
    );

    if (!this.settings) {
      // A disabled platform pool provisions nothing. It keeps the choice of the operator until the deployment sets the platform provisioner again.
      await this.deleteEach(
        platform.filter(
          (each) => opened.has(each.workspaceId.value) && !each.isDisabled,
        ),
      );
      return;
    }

    const settings = this.settings;
    const found = new Map(keyed.map((each) => [each.workspaceId.value, each]));

    for (const workspaceId of open) {
      const pool = found.get(workspaceId.value);

      await this.step(workspaceId, () =>
        pool
          ? this.reconcilePool(pool, settings)
          : this.create(workspaceId, settings),
      );
    }
  }

  // Adds the platform pool to a workspace that was just created.
  async add(workspaceId: WorkspaceId): Promise<void> {
    // The event can arrive after the workspace is deleted.
    if (!this.settings || !(await this.workspaces.isOpen(workspaceId))) {
      return;
    }

    const pool = await this.platformKeyHolder(workspaceId);

    try {
      await (pool
        ? this.reconcilePool(pool, this.settings)
        : this.create(workspaceId, this.settings));
    } catch (error) {
      if (!lostRace(error)) {
        throw error;
      }
    }
  }

  // The platform pool of the workspace stays disabled across restarts, until it is enabled again.
  disable(
    workspaceId: WorkspaceId,
    by: ChangeActor,
  ): Promise<PlatformPoolChangeDto | null> {
    return this.change(workspaceId, true, by);
  }

  enable(
    workspaceId: WorkspaceId,
    by: ChangeActor,
  ): Promise<PlatformPoolChangeDto | null> {
    return this.change(workspaceId, false, by);
  }

  private async change(
    workspaceId: WorkspaceId,
    disabled: boolean,
    by: ChangeActor,
  ): Promise<PlatformPoolChangeDto | null> {
    if (!by.workspaceId.equals(workspaceId)) {
      throw new InconsistentStateError(
        'platform pool change',
        'names an actor of another workspace',
      );
    }

    if (!this.settings) {
      return { outcome: 'unset' };
    }

    if (!(await this.workspaces.isOpen(workspaceId))) {
      return null;
    }

    const found = await this.platformKeyHolder(workspaceId);

    if (found && !found.isPlatform) {
      return { outcome: 'key-taken' };
    }

    const pool =
      found ??
      RunnerPool.createPlatform({
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

    return { outcome: changed.isDisabled ? 'disabled' : 'enabled' };
  }

  private async platformKeyHolder(
    workspaceId: WorkspaceId,
  ): Promise<RunnerPool | null> {
    return (
      (await this.pools.inWorkspace(workspaceId)).find((each) =>
        each.key.equals(PoolKey.platform()),
      ) ?? null
    );
  }

  private async create(
    workspaceId: WorkspaceId,
    settings: PlatformPoolSettings,
  ): Promise<void> {
    const pool = RunnerPool.createPlatform({
      id: PoolId.of(this.ids.generate()),
      workspaceId,
      labels: settings.labels,
      egress: settings.egress,
      by: ChangeActor.spotlight(workspaceId),
    });

    await this.transaction.inTransaction(() => this.pools.add(pool));
    this.logger.info(
      { workspaceId: workspaceId.value, pool: pool.id.value },
      'Added the platform runner pool to a workspace',
    );
  }

  private async reconcilePool(
    pool: RunnerPool,
    settings: PlatformPoolSettings,
  ): Promise<void> {
    if (!pool.isPlatform) {
      this.logger.info(
        { workspaceId: pool.workspaceId.value, pool: pool.id.value },
        `Did not add the platform runner pool, because the workspace has its own pool ${pool.key.value}`,
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

  private async deleteEach(pools: readonly RunnerPool[]): Promise<void> {
    for (const pool of pools) {
      await this.step(pool.workspaceId, () =>
        this.transaction.inTransaction(() =>
          this.pools.save(pool.delete(ChangeActor.spotlight(pool.workspaceId))),
        ),
      );
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
        'Could not reconcile the platform runner pool of a workspace',
      );
    }
  }
}

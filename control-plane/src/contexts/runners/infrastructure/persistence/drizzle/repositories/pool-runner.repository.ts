import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { PoolRunner } from '@runners/domain/aggregates/pool-runner.aggregate';
import { PoolRunnerMovedOnError } from '@runners/domain/exceptions/pool-runner-moved-on.error';
import type { PoolRunnerRepository } from '@runners/domain/repositories/pool-runner.repository';
import { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import {
  PoolWork,
  type PoolWorkKind,
} from '@runners/domain/value-objects/pool-work.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { poolRunner } from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { HarnessVersion } from '@shared-kernel/domain/value-objects/harness-version.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, gt, isNotNull, isNull, or } from 'drizzle-orm';

type Row = typeof poolRunner.$inferSelect;

const WORK_KINDS: readonly PoolWorkKind[] = ['run', 'check'];

const workOf = (row: Row): PoolWork | null => {
  if (row.workKind === null || row.workId === null) {
    return null;
  }

  const kind = WORK_KINDS.find((each) => each === row.workKind);

  if (!kind) {
    throw new InconsistentStateError(
      'pool runner',
      `holds work of an unknown kind (${row.workKind})`,
    );
  }

  return PoolWork.of(kind, row.workId);
};

const toRunner = (row: Row): PoolRunner =>
  PoolRunner.rehydrate({
    id: RunnerId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    poolId: RunnerPoolId.of(row.poolId),
    labels: RunnerLabels.of(row.labels),
    tokenHash: TokenHash.of(row.tokenHash),
    installed: row.harnesses.map((id) =>
      InstalledHarness.of(
        HarnessId.of(id),
        (row.advertisedModels[id] ?? []).map(HarnessModel.of),
        row.harnessVersions[id]
          ? HarnessVersion.of(row.harnessVersions[id])
          : null,
      ),
    ),
    work: workOf(row),
    claimBy: row.claimBy,
    startedAt: row.startedAt,
    lastSeenAt: row.lastSeenAt,
    endedAt: row.endedAt,
    version: row.version,
  });

const heldOf = (runner: PoolRunner) => ({
  harnesses: runner.installed.map((each) => each.id.value),
  advertisedModels: Object.fromEntries(
    runner.installed.map((each) => [
      each.id.value,
      each.models.map((model) => model.value),
    ]),
  ),
  harnessVersions: Object.fromEntries(
    runner.installed.flatMap((each) =>
      each.version ? [[each.id.value, each.version.value]] : [],
    ),
  ),
  workKind: runner.work?.kind ?? null,
  workId: runner.work?.id ?? null,
  lastSeenAt: runner.lastSeenAt,
  endedAt: runner.endedAt,
});

@Injectable()
export class DrizzlePoolRunnerRepository implements PoolRunnerRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: PoolRunner): Promise<void> {
    await this.context.run(async () => {
      await this.context.db.insert(poolRunner).values({
        id: added.id.value,
        workspaceId: added.workspaceId.value,
        poolId: added.poolId.value,
        labels: [...added.labels.values],
        tokenHash: added.tokenHash.value,
        claimBy: added.claimBy,
        startedAt: added.startedAt,
        ...heldOf(added),
        version: added.version,
      });

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: PoolRunner): Promise<void> {
    await this.context.run(async () => {
      const matching = and(
        eq(poolRunner.id, saved.id.value),
        eq(poolRunner.version, saved.version),
      );
      const written = saved.isDiscarded
        ? await this.context.db
            .delete(poolRunner)
            .where(matching)
            .returning({ id: poolRunner.id })
        : await this.context.db
            .update(poolRunner)
            .set({ ...heldOf(saved), version: saved.version + 1 })
            .where(matching)
            .returning({ id: poolRunner.id });

      if (written.length === 0) {
        throw new PoolRunnerMovedOnError(saved.id.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async find(id: RunnerId): Promise<PoolRunner | null> {
    const [found] = await this.context.db
      .select()
      .from(poolRunner)
      .where(eq(poolRunner.id, id.value))
      .limit(1);

    return found ? toRunner(found) : null;
  }

  async findByTokenHash(hash: TokenHash): Promise<PoolRunner | null> {
    const [found] = await this.context.db
      .select()
      .from(poolRunner)
      .where(eq(poolRunner.tokenHash, hash.value))
      .limit(1);

    return found ? toRunner(found) : null;
  }

  async standingIn(
    poolId: RunnerPoolId,
    now: Date,
  ): Promise<readonly PoolRunner[]> {
    const rows = await this.context.db
      .select()
      .from(poolRunner)
      .where(
        and(
          eq(poolRunner.poolId, poolId.value),
          isNull(poolRunner.endedAt),
          or(
            and(
              isNotNull(poolRunner.workId),
              gt(poolRunner.lastSeenAt, PoolRunner.unseenSinceLongestHold(now)),
            ),
            and(isNull(poolRunner.workId), gt(poolRunner.claimBy, now)),
          ),
        ),
      );

    return rows.map(toRunner).filter((each) => each.standsAt(now));
  }

  async holding(work: PoolWork): Promise<readonly PoolRunner[]> {
    const rows = await this.context.db
      .select()
      .from(poolRunner)
      .where(
        and(
          eq(poolRunner.workKind, work.kind),
          eq(poolRunner.workId, work.id),
          isNull(poolRunner.endedAt),
        ),
      );

    return rows.map(toRunner);
  }
}

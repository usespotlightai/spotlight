import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { RunnerVersionConflictError } from '@runners/domain/exceptions/runner-version-conflict.error';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { HarnessVersion } from '@runners/domain/value-objects/harness-version.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import {
  RunnerWork,
  type RunnerWorkKind,
} from '@runners/domain/value-objects/runner-work.vo';
import { runner } from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunningImage } from '@shared-kernel/domain/value-objects/running-image.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, gt, isNotNull, isNull, or } from 'drizzle-orm';

type Row = typeof runner.$inferSelect;

const WORK_KINDS: readonly RunnerWorkKind[] = ['run', 'check'];

const workOf = (row: Row): RunnerWork | null => {
  if (row.workKind === null || row.workId === null) {
    return null;
  }

  const kind = WORK_KINDS.find((each) => each === row.workKind);

  if (!kind) {
    throw new InconsistentStateError(
      'runner',
      `has a lease on work of an unknown kind (${row.workKind})`,
    );
  }

  return RunnerWork.of(kind, row.workId);
};

const credentialSourceOf = (row: Row): CredentialSource => {
  if (row.poolId !== null) {
    return CredentialSource.of('pool', row.poolId);
  }
  if (row.trustId !== null) {
    return CredentialSource.of('trust', row.trustId);
  }

  throw new InconsistentStateError(
    'runner',
    'came in through neither a pool nor a trust',
  );
};

const toRunner = (row: Row): Runner =>
  Runner.rehydrate({
    id: RunnerId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    source: credentialSourceOf(row),
    hostId: row.hostId === null ? null : HostId.of(row.hostId),
    labels: RunnerLabels.of(row.labels),
    tokenHash: TokenHash.of(row.tokenHash),
    egressTokenHash:
      row.egressTokenHash === null ? null : TokenHash.of(row.egressTokenHash),
    proxyCredentialHash:
      row.proxyCredentialHash === null
        ? null
        : TokenHash.of(row.proxyCredentialHash),
    installed: row.harnesses.map((id) =>
      InstalledHarness.of(
        HarnessId.of(id),
        row.advertisedModels[id].map(HarnessModel.of),
        row.harnessVersions[id]
          ? HarnessVersion.of(row.harnessVersions[id])
          : null,
      ),
    ),
    running:
      row.image === null
        ? null
        : RunningImage.of(RunnerImage.of(row.image), row.isDefault),
    work: workOf(row),
    claimBy: row.claimBy,
    startedAt: row.startedAt,
    lastHeartbeatAt: row.lastHeartbeatAt,
    endedAt: row.endedAt,
    version: row.version,
  });

const columnsOf = (runner: Runner) => ({
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
  lastHeartbeatAt: runner.lastHeartbeatAt,
  endedAt: runner.endedAt,
});

@Injectable()
export class DrizzleRunnerRepository implements RunnerRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: Runner): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db.insert(runner).values({
        id: added.id.value,
        workspaceId: added.workspaceId.value,
        poolId: added.source.poolId?.value ?? null,
        trustId: added.source.trustId?.value ?? null,
        hostId: added.hostId?.value ?? null,
        labels: [...added.labels.values],
        tokenHash: added.tokenHash.value,
        egressTokenHash: added.egressTokenHash?.value ?? null,
        proxyCredentialHash: added.proxyCredentialHash?.value ?? null,
        image: added.running?.image.value ?? null,
        isDefault: added.running?.isDefault ?? false,
        claimBy: added.claimBy,
        startedAt: added.startedAt,
        ...columnsOf(added),
        version: added.version,
      });

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: Runner): Promise<void> {
    await this.context.inTransaction(async () => {
      const matching = and(
        eq(runner.id, saved.id.value),
        eq(runner.version, saved.version),
      );
      const written = saved.isDiscarded
        ? await this.context.db
            .delete(runner)
            .where(matching)
            .returning({ id: runner.id })
        : await this.context.db
            .update(runner)
            .set({ ...columnsOf(saved), version: saved.version + 1 })
            .where(matching)
            .returning({ id: runner.id });

      if (written.length === 0) {
        throw new RunnerVersionConflictError(saved.id.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async find(id: RunnerId): Promise<Runner | null> {
    const [found] = await this.context.db
      .select()
      .from(runner)
      .where(eq(runner.id, id.value))
      .limit(1);

    return found ? toRunner(found) : null;
  }

  async findByTokenHash(hash: TokenHash): Promise<Runner | null> {
    const [found] = await this.context.db
      .select()
      .from(runner)
      .where(eq(runner.tokenHash, hash.value))
      .limit(1);

    return found ? toRunner(found) : null;
  }

  async findByEgressTokenHash(hash: TokenHash): Promise<Runner | null> {
    const [found] = await this.context.db
      .select()
      .from(runner)
      .where(eq(runner.egressTokenHash, hash.value))
      .limit(1);

    return found ? toRunner(found) : null;
  }

  async findByProxyCredentialHash(hash: TokenHash): Promise<Runner | null> {
    const [found] = await this.context.db
      .select()
      .from(runner)
      .where(eq(runner.proxyCredentialHash, hash.value))
      .limit(1);

    return found ? toRunner(found) : null;
  }

  async aliveIn(poolId: RunnerPoolId, now: Date): Promise<readonly Runner[]> {
    const rows = await this.context.db
      .select()
      .from(runner)
      .where(
        and(
          eq(runner.poolId, poolId.value),
          isNull(runner.endedAt),
          or(
            and(
              isNotNull(runner.workId),
              gt(runner.lastHeartbeatAt, Runner.heartbeatTimedOutBefore(now)),
            ),
            and(isNull(runner.workId), gt(runner.claimBy, now)),
          ),
        ),
      );

    return rows.map(toRunner).filter((each) => each.isAlive(now));
  }

  async findByWork(work: RunnerWork): Promise<readonly Runner[]> {
    const rows = await this.context.db
      .select()
      .from(runner)
      .where(
        and(
          eq(runner.workKind, work.kind),
          eq(runner.workId, work.id),
          isNull(runner.endedAt),
        ),
      );

    return rows.map(toRunner);
  }
}

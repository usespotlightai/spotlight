import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import { RunnerHostVersionConflictError } from '@runners/domain/exceptions/runner-host-version-conflict.error';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import { BootId } from '@runners/domain/value-objects/boot-id.vo';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { HostReport } from '@runners/domain/value-objects/host-report.vo';
import {
  type HostImageRecord,
  runnerHost,
} from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, lte } from 'drizzle-orm';

type Row = typeof runnerHost.$inferSelect;

const credentialSourceOf = (row: Row): CredentialSource => {
  if (row.poolId !== null) {
    return CredentialSource.of('pool', row.poolId);
  }
  if (row.trustId !== null) {
    return CredentialSource.of('trust', row.trustId);
  }

  throw new InconsistentStateError(
    'runner host',
    'serves neither a pool nor a trust',
  );
};

const toHost = (row: Row): RunnerHost =>
  RunnerHost.rehydrate({
    id: HostId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    source: credentialSourceOf(row),
    bootId: BootId.of(row.bootId),
    report: HostReport.of({
      name: row.name,
      release: row.release,
      containerRuntime: row.containerRuntime,
      capacity: row.capacity,
      running: row.running,
      images: row.images,
    }),
    firstHeartbeatAt: row.firstHeartbeatAt,
    onlineSince: row.onlineSince,
    lastHeartbeatAt: row.lastHeartbeatAt,
    version: row.version,
  });

const columnsOf = (host: RunnerHost) => ({
  workspaceId: host.workspaceId.value,
  poolId: host.source.poolId?.value ?? null,
  trustId: host.source.trustId?.value ?? null,
  bootId: host.bootId.value,
  name: host.report.name,
  release: host.report.release,
  containerRuntime: host.report.containerRuntime,
  capacity: host.report.capacity,
  running: host.report.running.map((each) => each.value),
  images: host.report.images.map(
    (each): HostImageRecord => ({
      image: each.image.value,
      isDefault: each.isDefault,
      harnesses: each.harnesses.map((harness) => ({
        id: harness.id.value,
        models: harness.models.map((model) => model.value),
        ...(harness.version ? { version: harness.version.value } : {}),
      })),
      ...(each.digest ? { digest: each.digest.value } : {}),
      ...(each.release ? { release: each.release } : {}),
      ...(each.unavailableReason
        ? { unavailableReason: each.unavailableReason }
        : {}),
    }),
  ),
  firstHeartbeatAt: host.firstHeartbeatAt,
  onlineSince: host.onlineSince,
  lastHeartbeatAt: host.lastHeartbeatAt,
});

@Injectable()
export class DrizzleRunnerHostRepository implements RunnerHostRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async find(id: HostId): Promise<RunnerHost | null> {
    const [found] = await this.context.db
      .select()
      .from(runnerHost)
      .where(eq(runnerHost.id, id.value))
      .limit(1);

    return found ? toHost(found) : null;
  }

  async add(host: RunnerHost): Promise<void> {
    await this.context.inTransaction(async () => {
      try {
        await this.context.db.insert(runnerHost).values({
          id: host.id.value,
          ...columnsOf(host),
          version: host.version,
        });
      } catch (error) {
        if (violates(error, UNIQUE_VIOLATION, 'runner_host_pkey')) {
          throw new RunnerHostVersionConflictError(host.id.value);
        }

        throw error;
      }

      await this.events.dispatch(host.pullEvents());
    });
  }

  async save(host: RunnerHost): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .update(runnerHost)
        .set({ ...columnsOf(host), version: host.version + 1 })
        .where(
          and(
            eq(runnerHost.id, host.id.value),
            eq(runnerHost.version, host.version),
          ),
        )
        .returning({ id: runnerHost.id });

      if (written.length === 0) {
        throw new RunnerHostVersionConflictError(host.id.value);
      }

      await this.events.dispatch(host.pullEvents());
    });
  }

  async remove(host: RunnerHost): Promise<void> {
    const removed = await this.context.db
      .delete(runnerHost)
      .where(
        and(
          eq(runnerHost.id, host.id.value),
          eq(runnerHost.version, host.version),
        ),
      )
      .returning({ id: runnerHost.id });

    if (removed.length === 0) {
      throw new RunnerHostVersionConflictError(host.id.value);
    }
  }

  async removeThrough(source: CredentialSource): Promise<void> {
    await this.context.db
      .delete(runnerHost)
      .where(
        source.kind === 'pool'
          ? eq(runnerHost.poolId, source.id)
          : eq(runnerHost.trustId, source.id),
      );
  }

  async removeStaleBefore(cutoff: Date): Promise<number> {
    const removed = await this.context.db
      .delete(runnerHost)
      .where(lte(runnerHost.lastHeartbeatAt, cutoff))
      .returning({ id: runnerHost.id });

    return removed.length;
  }
}

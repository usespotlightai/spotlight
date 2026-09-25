import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import { RunnerHostMovedOnError } from '@runners/domain/exceptions/runner-host-moved-on.error';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import { Admission } from '@runners/domain/value-objects/admission.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { HostReport } from '@runners/domain/value-objects/host-report.vo';
import {
  type HeldImage,
  runnerHost,
} from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, lt } from 'drizzle-orm';

type Row = typeof runnerHost.$inferSelect;

const admissionOf = (row: Row): Admission => {
  if (row.poolId !== null) {
    return Admission.of('pool', row.poolId);
  }
  if (row.trustId !== null) {
    return Admission.of('trust', row.trustId);
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
    admission: admissionOf(row),
    report: HostReport.of({
      name: row.name,
      release: row.release,
      executor: row.executor,
      capacity: row.capacity,
      running: row.running,
      images: row.images,
    }),
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
    version: row.version,
  });

const heldOf = (host: RunnerHost) => ({
  workspaceId: host.workspaceId.value,
  poolId: host.admission.poolId?.value ?? null,
  trustId: host.admission.trustId?.value ?? null,
  name: host.report.name,
  release: host.report.release,
  executor: host.report.executor,
  capacity: host.report.capacity,
  running: host.report.running.map((each) => each.value),
  images: host.report.images.map(
    (each): HeldImage => ({
      image: each.image.value,
      usual: each.usual,
      harnesses: each.harnesses.map((harness) => ({
        id: harness.id.value,
        models: harness.models.map((model) => model.value),
        ...(harness.version ? { version: harness.version.value } : {}),
      })),
      ...(each.digest ? { digest: each.digest.value } : {}),
      ...(each.release ? { release: each.release } : {}),
      ...(each.refused ? { refused: each.refused } : {}),
    }),
  ),
  firstSeenAt: host.firstSeenAt,
  lastSeenAt: host.lastSeenAt,
});

@Injectable()
export class DrizzleRunnerHostRepository implements RunnerHostRepository {
  constructor(private readonly context: DrizzleContext) {}

  async find(id: HostId): Promise<RunnerHost | null> {
    const [found] = await this.context.db
      .select()
      .from(runnerHost)
      .where(eq(runnerHost.id, id.value))
      .limit(1);

    return found ? toHost(found) : null;
  }

  async add(host: RunnerHost): Promise<void> {
    try {
      await this.context.db
        .insert(runnerHost)
        .values({ id: host.id.value, ...heldOf(host), version: host.version });
    } catch (error) {
      if (violates(error, UNIQUE_VIOLATION, 'runner_host_pkey')) {
        throw new RunnerHostMovedOnError(host.id.value);
      }

      throw error;
    }
  }

  async save(host: RunnerHost): Promise<void> {
    const written = await this.context.db
      .update(runnerHost)
      .set({ ...heldOf(host), version: host.version + 1 })
      .where(
        and(
          eq(runnerHost.id, host.id.value),
          eq(runnerHost.version, host.version),
        ),
      )
      .returning({ id: runnerHost.id });

    if (written.length === 0) {
      throw new RunnerHostMovedOnError(host.id.value);
    }
  }

  async remove(host: RunnerHost): Promise<void> {
    await this.context.db
      .delete(runnerHost)
      .where(
        and(
          eq(runnerHost.id, host.id.value),
          eq(runnerHost.version, host.version),
        ),
      );
  }

  async removeThrough(admission: Admission): Promise<void> {
    const { poolId, trustId } = admission;

    await this.context.db
      .delete(runnerHost)
      .where(
        poolId
          ? eq(runnerHost.poolId, poolId.value)
          : eq(runnerHost.trustId, trustId?.value ?? ''),
      );
  }

  async removeUnseenSince(since: Date): Promise<number> {
    const removed = await this.context.db
      .delete(runnerHost)
      .where(lt(runnerHost.lastSeenAt, since))
      .returning({ id: runnerHost.id });

    return removed.length;
  }
}

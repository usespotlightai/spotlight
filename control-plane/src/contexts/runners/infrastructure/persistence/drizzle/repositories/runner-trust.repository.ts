import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import { RunnerTrust } from '@runners/domain/aggregates/runner-trust.aggregate';
import { RunnerTrustAlreadyDefinedError } from '@runners/domain/exceptions/runner-trust-already-defined.error';
import { RunnerTrustVersionConflictError } from '@runners/domain/exceptions/runner-trust-version-conflict.error';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import { runnerTrust } from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq } from 'drizzle-orm';

type Row = typeof runnerTrust.$inferSelect;

const toTrust = (row: Row): RunnerTrust =>
  RunnerTrust.rehydrate({
    id: RunnerTrustId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    key: TrustKey.of(row.key),
    workload: TrustedWorkload.of({
      issuer: row.issuer,
      subject: row.subject,
      audience: row.audience,
    }),
    labels: RunnerLabels.of(row.labels),
    version: row.version,
  });

const definitionOf = (trust: RunnerTrust) => ({
  key: trust.key.value,
  issuer: trust.workload.issuer,
  subject: trust.workload.subject,
  audience: trust.workload.audience,
  labels: [...trust.labels.values],
});

@Injectable()
export class DrizzleRunnerTrustRepository implements RunnerTrustRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: RunnerTrust): Promise<void> {
    await this.context.inTransaction(async () => {
      try {
        await this.context.db.insert(runnerTrust).values({
          id: added.id.value,
          workspaceId: added.workspaceId.value,
          ...definitionOf(added),
          version: added.version,
        });
      } catch (error) {
        if (violates(error, UNIQUE_VIOLATION, 'runner_trust_workspace_key')) {
          throw new RunnerTrustAlreadyDefinedError(added.key.value);
        }

        throw error;
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: RunnerTrust): Promise<void> {
    await this.context.inTransaction(async () => {
      const matching = and(
        eq(runnerTrust.id, saved.id.value),
        eq(runnerTrust.version, saved.version),
      );
      const written = saved.isWithdrawn
        ? await this.context.db
            .delete(runnerTrust)
            .where(matching)
            .returning({ id: runnerTrust.id })
        : await this.context.db
            .update(runnerTrust)
            .set({ ...definitionOf(saved), version: saved.version + 1 })
            .where(matching)
            .returning({ id: runnerTrust.id });

      if (written.length === 0) {
        throw new RunnerTrustVersionConflictError(saved.id.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async find(id: RunnerTrustId): Promise<RunnerTrust | null> {
    const [found] = await this.context.db
      .select()
      .from(runnerTrust)
      .where(eq(runnerTrust.id, id.value))
      .limit(1);

    return found ? toTrust(found) : null;
  }

  async inWorkspace(workspaceId: WorkspaceId): Promise<readonly RunnerTrust[]> {
    const rows = await this.context.db
      .select()
      .from(runnerTrust)
      .where(eq(runnerTrust.workspaceId, workspaceId.value));

    return rows.map(toTrust);
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { RunnerMovedOnError } from '@runners/domain/exceptions/runner-moved-on.error';
import { RunnerNameTakenError } from '@runners/domain/exceptions/runner-name-taken.error';
import { RunnerTokenTakenError } from '@runners/domain/exceptions/runner-token-taken.error';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerName } from '@runners/domain/value-objects/runner-name.vo';
import { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import { runner } from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { HarnessVersion } from '@shared-kernel/domain/value-objects/harness-version.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, isNull } from 'drizzle-orm';

type Row = typeof runner.$inferSelect;

const tokenTakenOr = (error: unknown): unknown =>
  violates(error, UNIQUE_VIOLATION, 'runner_token_hash')
    ? new RunnerTokenTakenError()
    : error;

const toRunner = (row: Row): Runner =>
  Runner.rehydrate({
    id: RunnerId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    name: RunnerName.of(row.name),
    tokenHash: TokenHash.of(row.tokenHash),
    labels: RunnerLabels.of(row.labels),
    trustId: row.trustId ? RunnerTrustId.of(row.trustId) : null,
    installed: row.harnesses.map((id) =>
      InstalledHarness.of(
        HarnessId.of(id),
        (row.advertisedModels[id] ?? []).map(HarnessModel.of),
        row.harnessVersions[id]
          ? HarnessVersion.of(row.harnessVersions[id])
          : null,
      ),
    ),
    revokedAt: row.revokedAt,
    lastSeenAt: row.lastSeenAt,
    revision: row.revision,
    version: row.version,
  });

const harnessesOf = (installed: readonly InstalledHarness[]): string[] =>
  installed.map((each) => each.id.value);

const advertisedOf = (
  installed: readonly InstalledHarness[],
): Record<string, string[]> =>
  Object.fromEntries(
    installed.map((each) => [
      each.id.value,
      each.models.map((model) => model.value),
    ]),
  );

const versionsOf = (
  installed: readonly InstalledHarness[],
): Record<string, string> =>
  Object.fromEntries(
    installed.flatMap((each) =>
      each.version ? [[each.id.value, each.version.value]] : [],
    ),
  );

@Injectable()
export class DrizzleRunnerRepository implements RunnerRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: Runner): Promise<void> {
    await this.context.run(async () => {
      await this.inserted(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  private async inserted(added: Runner): Promise<void> {
    try {
      await this.context.db.insert(runner).values({
        id: added.id.value,
        workspaceId: added.workspaceId.value,
        name: added.name.value,
        tokenHash: added.tokenHash.value,
        labels: [...added.labels.values],
        trustId: added.trustId?.value ?? null,
        harnesses: harnessesOf(added.installed),
        advertisedModels: advertisedOf(added.installed),
        harnessVersions: versionsOf(added.installed),
        revokedAt: added.revokedAt,
        lastSeenAt: added.lastSeenAt,
        revision: added.revision,
        version: added.version,
      });
    } catch (error) {
      if (violates(error, UNIQUE_VIOLATION, 'runner_workspace_name')) {
        throw new RunnerNameTakenError(added.name.value);
      }

      throw tokenTakenOr(error);
    }
  }

  async save(saved: Runner): Promise<void> {
    await this.context.run(async () => {
      await this.stored(saved);
      await this.events.dispatch(saved.pullEvents());
    });
  }

  private async stored(saved: Runner): Promise<void> {
    const written = await this.context.db
      .update(runner)
      .set({
        version: saved.version + 1,
        revision: saved.revision,
        tokenHash: saved.tokenHash.value,
        labels: [...saved.labels.values],
        revokedAt: saved.revokedAt,
        lastSeenAt: saved.lastSeenAt,
        harnesses: harnessesOf(saved.installed),
        advertisedModels: advertisedOf(saved.installed),
        harnessVersions: versionsOf(saved.installed),
      })
      .where(
        and(eq(runner.id, saved.id.value), eq(runner.version, saved.version)),
      )
      .returning({ id: runner.id })
      .catch((error: unknown) => {
        throw tokenTakenOr(error);
      });

    if (written.length === 0) {
      throw new RunnerMovedOnError(saved.id.value);
    }
  }

  async find(id: RunnerId): Promise<Runner | null> {
    const [found] = await this.context.db
      .select()
      .from(runner)
      .where(eq(runner.id, id.value))
      .limit(1);

    return found ? toRunner(found) : null;
  }

  async enrolledUnder(
    trustId: RunnerTrustId,
    name: RunnerName,
  ): Promise<Runner | null> {
    const [found] = await this.context.db
      .select()
      .from(runner)
      .where(
        and(
          eq(runner.trustId, trustId.value),
          eq(runner.name, name.value),
          isNull(runner.revokedAt),
        ),
      )
      .limit(1);

    return found ? toRunner(found) : null;
  }

  async underTrust(trustId: RunnerTrustId): Promise<readonly Runner[]> {
    const rows = await this.context.db
      .select()
      .from(runner)
      .where(and(eq(runner.trustId, trustId.value), isNull(runner.revokedAt)));

    return rows.map(toRunner);
  }

  async standingIn(workspaceId: WorkspaceId): Promise<readonly Runner[]> {
    const rows = await this.context.db
      .select()
      .from(runner)
      .where(
        and(
          eq(runner.workspaceId, workspaceId.value),
          isNull(runner.revokedAt),
        ),
      );

    return rows.map(toRunner);
  }

  async findByTokenHash(hash: TokenHash): Promise<Runner | null> {
    const [found] = await this.context.db
      .select()
      .from(runner)
      .where(eq(runner.tokenHash, hash.value))
      .limit(1);

    return found ? toRunner(found) : null;
  }
}

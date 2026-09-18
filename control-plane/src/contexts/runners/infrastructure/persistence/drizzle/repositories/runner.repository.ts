import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { RunnerMovedOnError } from '@runners/domain/exceptions/runner-moved-on.error';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import { RunnerName } from '@runners/domain/value-objects/runner-name.vo';
import { runner } from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq } from 'drizzle-orm';

type Row = typeof runner.$inferSelect;

const toRunner = (row: Row): Runner =>
  Runner.rehydrate({
    id: RunnerId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    name: RunnerName.of(row.name),
    tokenHash: TokenHash.of(row.tokenHash),
    installed: row.harnesses.map((id) =>
      InstalledHarness.of(
        HarnessId.of(id),
        (row.advertisedModels[id] ?? []).map(HarnessModel.of),
      ),
    ),
    revokedAt: row.revokedAt,
    lastSeenAt: row.lastSeenAt,
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
    await this.context.db.insert(runner).values({
      id: added.id.value,
      workspaceId: added.workspaceId.value,
      name: added.name.value,
      tokenHash: added.tokenHash.value,
      harnesses: harnessesOf(added.installed),
      advertisedModels: advertisedOf(added.installed),
      revokedAt: added.revokedAt,
      lastSeenAt: added.lastSeenAt,
      version: added.version,
    });
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
        revokedAt: saved.revokedAt,
        lastSeenAt: saved.lastSeenAt,
        harnesses: harnessesOf(saved.installed),
        advertisedModels: advertisedOf(saved.installed),
      })
      .where(
        and(eq(runner.id, saved.id.value), eq(runner.version, saved.version)),
      )
      .returning({ id: runner.id });

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

  async findByTokenHash(hash: TokenHash): Promise<Runner | null> {
    const [found] = await this.context.db
      .select()
      .from(runner)
      .where(eq(runner.tokenHash, hash.value))
      .limit(1);

    return found ? toRunner(found) : null;
  }
}

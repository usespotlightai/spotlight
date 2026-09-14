import {
  type InstalledHarness,
  Runner,
} from '@domain/aggregates/runner.aggregate';
import type { RunnerRepository } from '@domain/repositories/runner.repository';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { HarnessModel } from '@domain/value-objects/harness-model.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { RunnerName } from '@domain/value-objects/runner-name.vo';
import { TokenHash } from '@domain/value-objects/token-hash.vo';
import { DrizzleContext } from '@infrastructure/persistence/drizzle/drizzle.context';
import { runner } from '@infrastructure/persistence/drizzle/schemas/run.schema';
import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

type Row = typeof runner.$inferSelect;

const toRunner = (row: Row): Runner =>
  Runner.rehydrate({
    id: RunnerId.of(row.id),
    name: RunnerName.of(row.name),
    tokenHash: TokenHash.of(row.tokenHash),
    installed: row.harnesses.map((id) => ({
      id: HarnessId.of(id),
      models: (row.advertisedModels[id] ?? []).map(HarnessModel.of),
    })),
    revokedAt: row.revokedAt,
    lastSeenAt: row.lastSeenAt,
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
  constructor(private readonly context: DrizzleContext) {}

  async add(added: Runner): Promise<void> {
    await this.context.db.insert(runner).values({
      id: added.id.value,
      name: added.name.value,
      tokenHash: added.tokenHash.value,
      harnesses: harnessesOf(added.installed),
      advertisedModels: advertisedOf(added.installed),
      revokedAt: added.revokedAt,
      lastSeenAt: added.lastSeenAt,
    });
  }

  async save(saved: Runner): Promise<void> {
    await this.context.db
      .update(runner)
      .set({
        revokedAt: saved.revokedAt,
        lastSeenAt: saved.lastSeenAt,
        harnesses: harnessesOf(saved.installed),
        advertisedModels: advertisedOf(saved.installed),
      })
      .where(eq(runner.id, saved.id.value));
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

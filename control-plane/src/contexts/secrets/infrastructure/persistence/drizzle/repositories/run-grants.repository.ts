import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { RunGrants } from '@secrets/domain/aggregates/run-grants.aggregate';
import { RunGrantsVersionConflictError } from '@secrets/domain/exceptions/run-grants-version-conflict.error';
import type { RunGrantsRepository } from '@secrets/domain/repositories/run-grants.repository';
import { RedemptionRecipient } from '@secrets/domain/value-objects/redemption-recipient.vo';
import { RunHold } from '@secrets/domain/value-objects/run-hold.vo';
import { SecretGrant } from '@secrets/domain/value-objects/secret-grant.vo';
import { SecretId } from '@secrets/domain/value-objects/secret-id.vo';
import {
  runGrants,
  secretGrant,
} from '@secrets/infrastructure/persistence/drizzle/schemas/secret.schema';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, gt, inArray, lte, type SQL } from 'drizzle-orm';

type RunGrantsRow = typeof runGrants.$inferSelect;

export class DrizzleRunGrants implements RunGrantsRepository {
  constructor(
    private readonly context: DrizzleContext,
    private readonly events: DomainEventDispatcher,
  ) {}

  async find(runId: RunId): Promise<RunGrants | null> {
    const [kept] = await this.kept(eq(runGrants.runId, runId.value), 1);

    return kept ?? null;
  }

  async runsIn(workspaceId: WorkspaceId): Promise<readonly RunId[]> {
    const held = await this.context.db
      .select({ runId: runGrants.runId })
      .from(runGrants)
      .where(eq(runGrants.workspaceId, workspaceId.value))
      .orderBy(asc(runGrants.runId));

    return held.map((each) => RunId.of(each.runId));
  }

  async endedBy(
    at: Date,
    after: RunId | null,
    most: number,
  ): Promise<readonly RunId[]> {
    const ended = await this.context.db
      .select({ runId: runGrants.runId })
      .from(runGrants)
      .where(
        and(
          lte(runGrants.endedAt, at),
          after ? gt(runGrants.runId, after.value) : undefined,
        ),
      )
      .orderBy(asc(runGrants.runId))
      .limit(most);

    return ended.map((each) => RunId.of(each.runId));
  }

  async save(grants: RunGrants): Promise<void> {
    await this.context.run(async () => {
      if (grants.isDiscarded) {
        await this.forgotten(grants);
      } else {
        await this.stored(grants);
        await this.grantsStored(grants);
      }

      await this.events.dispatch(grants.pullEvents());
    });
  }

  private async kept(
    where: SQL | undefined,
    most?: number,
  ): Promise<RunGrants[]> {
    const selected = this.context.db
      .select()
      .from(runGrants)
      .where(where)
      .orderBy(asc(runGrants.runId));
    const rows = await (most === undefined ? selected : selected.limit(most));

    if (rows.length === 0) {
      return [];
    }

    const granted = await this.context.db
      .select()
      .from(secretGrant)
      .where(
        inArray(
          secretGrant.runId,
          rows.map((row) => row.runId),
        ),
      );

    return rows.map((row) =>
      toGrants(
        row,
        granted.filter((each) => each.runId === row.runId),
      ),
    );
  }

  private async forgotten(grants: RunGrants): Promise<void> {
    const forgotten = await this.context.db
      .delete(runGrants)
      .where(
        and(
          eq(runGrants.runId, grants.runId.value),
          eq(runGrants.version, grants.version),
        ),
      )
      .returning({ runId: runGrants.runId });

    if (forgotten.length === 0) {
      throw new RunGrantsVersionConflictError(grants.runId.value);
    }
  }

  private async stored(grants: RunGrants): Promise<void> {
    const fields = {
      attempt: grants.hold.attempt,
      recipient: grants.recipient?.key ?? null,
      holdLost: grants.isHoldLost,
      endedAt: grants.endedAt,
    };

    const touched = grants.isNew
      ? await this.context.db
          .insert(runGrants)
          .values({
            runId: grants.runId.value,
            workspaceId: grants.workspaceId.value,
            ...fields,
          })
          .onConflictDoNothing({ target: runGrants.runId })
          .returning({ runId: runGrants.runId })
      : await this.context.db
          .update(runGrants)
          .set({ ...fields, version: grants.version + 1 })
          .where(
            and(
              eq(runGrants.runId, grants.runId.value),
              eq(runGrants.version, grants.version),
            ),
          )
          .returning({ runId: runGrants.runId });

    if (touched.length === 0) {
      throw new RunGrantsVersionConflictError(grants.runId.value);
    }
  }

  private async grantsStored(grants: RunGrants): Promise<void> {
    const held = grants.grants.map((each) => ({
      secretId: each.secretId.value,
      host: each.host,
    }));
    const kept = await this.context.db
      .select({ secretId: secretGrant.secretId, host: secretGrant.host })
      .from(secretGrant)
      .where(eq(secretGrant.runId, grants.runId.value));
    const heldKeys = new Set(held.map(keyOf));
    const keptKeys = new Set(kept.map(keyOf));

    for (const gone of kept.filter((each) => !heldKeys.has(keyOf(each)))) {
      await this.context.db
        .delete(secretGrant)
        .where(
          and(
            eq(secretGrant.runId, grants.runId.value),
            eq(secretGrant.secretId, gone.secretId),
            eq(secretGrant.host, gone.host),
          ),
        );
    }

    const fresh = held.filter((each) => !keptKeys.has(keyOf(each)));

    if (fresh.length > 0) {
      await this.context.db
        .insert(secretGrant)
        .values(fresh.map((each) => ({ runId: grants.runId.value, ...each })));
    }
  }
}

interface GrantRow {
  readonly secretId: string;
  readonly host: string;
}

const keyOf = (grant: GrantRow): string =>
  JSON.stringify([grant.secretId, grant.host]);

const toGrants = (
  row: RunGrantsRow,
  granted: readonly GrantRow[],
): RunGrants => {
  const runId = RunId.of(row.runId);
  const workspaceId = WorkspaceId.of(row.workspaceId);

  return RunGrants.rehydrate({
    hold: RunHold.of(runId, row.attempt),
    workspaceId,
    grants: granted.map((each) =>
      SecretGrant.of({
        runId,
        workspaceId,
        secretId: SecretId.of(each.secretId),
        host: each.host,
      }),
    ),
    recipient:
      row.recipient === null ? null : RedemptionRecipient.of(row.recipient),
    holdLost: row.holdLost,
    endedAt: row.endedAt,
    version: row.version,
  });
};

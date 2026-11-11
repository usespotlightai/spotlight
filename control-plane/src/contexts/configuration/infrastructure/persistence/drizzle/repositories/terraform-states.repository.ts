import { TerraformLockBody } from '@configuration/application/mappers/terraform-lock-body.mapper';
import { TerraformState } from '@configuration/domain/aggregates/terraform-state.aggregate';
import { TerraformStateVersionConflictError } from '@configuration/domain/exceptions/terraform-state-version-conflict.error';
import type { TerraformStateRepository } from '@configuration/domain/repositories/terraform-state.repository';
import { PrincipalRef } from '@configuration/domain/value-objects/principal-ref.vo';
import type { StateLock } from '@configuration/domain/value-objects/state-lock.vo';
import { StateName } from '@configuration/domain/value-objects/state-name.vo';
import { StateSnapshot } from '@configuration/domain/value-objects/state-snapshot.vo';
import { StateVersion } from '@configuration/domain/value-objects/state-version.vo';
import { StateVersionId } from '@configuration/domain/value-objects/state-version-id.vo';
import { TerraformStateId } from '@configuration/domain/value-objects/terraform-state-id.vo';
import {
  type StateLockRow,
  terraformState,
  terraformStateVersion,
} from '@configuration/infrastructure/persistence/drizzle/schemas/configuration.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  codeOf,
  UNIQUE_VIOLATION,
} from '@platform/persistence/drizzle/violations';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, inArray } from 'drizzle-orm';

type StateRow = typeof terraformState.$inferSelect;
type VersionRow = typeof terraformStateVersion.$inferSelect;

const INSERTED_VERSION = 1;

const lockOf = (row: StateLockRow | null): StateLock | null =>
  row
    ? TerraformLockBody.lockOf(
        row.info,
        PrincipalRef.rehydrate(row.lockedBy),
        new Date(row.lockedAt),
      )
    : null;

const lockRowOf = (lock: StateLock | null): StateLockRow | null =>
  lock
    ? {
        id: lock.id.value,
        info: { ...lock.asWritten },
        lockedBy: lock.lockedBy.value,
        lockedAt: lock.lockedAt.toISOString(),
      }
    : null;

const versionOf = (row: VersionRow): StateVersion =>
  StateVersion.of({
    id: StateVersionId.of(row.id),
    number: row.number,
    snapshot: StateSnapshot.of({
      serial: row.serial,
      lineage: row.lineage,
      md5: row.md5,
      size: row.size,
    }),
    writtenBy: PrincipalRef.rehydrate(row.writtenBy),
    writtenAt: row.writtenAt,
  });

const versionRowOf = (state: TerraformState, version: StateVersion) => ({
  id: version.id.value,
  stateId: state.id.value,
  number: version.number,
  serial: version.snapshot.serial,
  lineage: version.snapshot.lineage,
  md5: version.snapshot.md5,
  size: version.snapshot.size,
  writtenBy: version.writtenBy.value,
  writtenAt: version.writtenAt,
});

@Injectable()
export class DrizzleTerraformStates implements TerraformStateRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async named(
    workspaceId: WorkspaceId,
    name: StateName,
  ): Promise<TerraformState | null> {
    const [row] = await this.context.db
      .select()
      .from(terraformState)
      .where(
        and(
          eq(terraformState.workspaceId, workspaceId.value),
          eq(terraformState.name, name.value),
        ),
      )
      .limit(1);

    return row ? this.rehydrated(row) : null;
  }

  async ofWorkspace(
    workspaceId: WorkspaceId,
  ): Promise<readonly TerraformState[]> {
    const rows = await this.context.db
      .select()
      .from(terraformState)
      .where(eq(terraformState.workspaceId, workspaceId.value));

    return Promise.all(rows.map((row) => this.rehydrated(row)));
  }

  async save(state: TerraformState): Promise<void> {
    await this.context.inTransaction(async () => {
      const events = state.pullEvents();

      if (state.isDeleted) {
        await this.deleted(state);
      } else {
        await this.stored(state);
      }

      await this.events.dispatch(events);
    });
  }

  private async rehydrated(row: StateRow): Promise<TerraformState> {
    const versions = await this.context.db
      .select()
      .from(terraformStateVersion)
      .where(eq(terraformStateVersion.stateId, row.id))
      .orderBy(asc(terraformStateVersion.number));

    return TerraformState.rehydrate({
      id: TerraformStateId.of(row.id),
      workspaceId: WorkspaceId.of(row.workspaceId),
      name: StateName.of(row.name),
      lock: lockOf(row.lock),
      versions: versions.map(versionOf),
      version: row.version,
    });
  }

  private async deleted(state: TerraformState): Promise<void> {
    const gone = await this.context.db
      .delete(terraformState)
      .where(
        and(
          eq(terraformState.id, state.id.value),
          eq(terraformState.version, state.version),
        ),
      )
      .returning({ id: terraformState.id });

    if (gone.length === 0) {
      throw new TerraformStateVersionConflictError(state.name.value);
    }
  }

  private async stored(state: TerraformState): Promise<void> {
    if (state.isNew) {
      await this.inserted(state);
    } else {
      await this.updated(state);
    }

    const kept = new Set(
      (
        await this.context.db
          .select({ id: terraformStateVersion.id })
          .from(terraformStateVersion)
          .where(eq(terraformStateVersion.stateId, state.id.value))
      ).map((row) => row.id),
    );
    const current = new Set(state.versions.map((each) => each.id.value));
    const added = state.versions.filter((each) => !kept.has(each.id.value));
    const dropped = [...kept].filter((id) => !current.has(id));

    if (added.length > 0) {
      await this.context.db
        .insert(terraformStateVersion)
        .values(added.map((each) => versionRowOf(state, each)));
    }

    if (dropped.length > 0) {
      await this.context.db
        .delete(terraformStateVersion)
        .where(
          and(
            eq(terraformStateVersion.stateId, state.id.value),
            inArray(terraformStateVersion.id, dropped),
          ),
        );
    }
  }

  private async updated(state: TerraformState): Promise<void> {
    const touched = await this.context.db
      .update(terraformState)
      .set({ lock: lockRowOf(state.lock), version: state.version + 1 })
      .where(
        and(
          eq(terraformState.id, state.id.value),
          eq(terraformState.version, state.version),
        ),
      )
      .returning({ version: terraformState.version });

    if (touched.length === 0) {
      throw new TerraformStateVersionConflictError(state.name.value);
    }
  }

  private async inserted(state: TerraformState): Promise<void> {
    try {
      await this.context.db.insert(terraformState).values({
        id: state.id.value,
        workspaceId: state.workspaceId.value,
        name: state.name.value,
        lock: lockRowOf(state.lock),
        version: INSERTED_VERSION,
      });
    } catch (error) {
      if (codeOf(error) === UNIQUE_VIOLATION) {
        throw new TerraformStateVersionConflictError(state.name.value);
      }

      throw error;
    }
  }
}

import { TerraformState } from '@configuration/domain/aggregates/terraform-state.aggregate';
import { TerraformStateVersionConflictError } from '@configuration/domain/exceptions/terraform-state-version-conflict.error';
import type { TerraformStateRepository } from '@configuration/domain/repositories/terraform-state.repository';
import { StateLock } from '@configuration/domain/value-objects/state-lock.vo';
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
import { and, eq, inArray, lt } from 'drizzle-orm';

type StateRow = typeof terraformState.$inferSelect;
type VersionRow = typeof terraformStateVersion.$inferSelect;

const lockOf = (row: StateLockRow | null): StateLock | null =>
  row
    ? StateLock.of({
        info: row.info,
        lockedBy: row.lockedBy,
        lockedAt: new Date(row.lockedAt),
      })
    : null;

const lockRowOf = (lock: StateLock | null): StateLockRow | null =>
  lock
    ? {
        id: lock.id,
        info: { ...lock.info },
        lockedBy: lock.lockedBy,
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
    writtenBy: row.writtenBy,
    writtenAt: row.writtenAt,
  });

const rehydrated = (row: StateRow, latest: VersionRow | null): TerraformState =>
  TerraformState.rehydrate({
    id: TerraformStateId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    name: StateName.of(row.name),
    lock: lockOf(row.lock),
    latest: latest ? versionOf(latest) : null,
    version: row.version,
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
    const [found] = await this.context.db
      .select({ state: terraformState, latest: terraformStateVersion })
      .from(terraformState)
      .leftJoin(
        terraformStateVersion,
        eq(terraformStateVersion.id, terraformState.latestVersionId),
      )
      .where(
        and(
          eq(terraformState.workspaceId, workspaceId.value),
          eq(terraformState.name, name.value),
        ),
      )
      .limit(1);

    return found ? rehydrated(found.state, found.latest) : null;
  }

  async save(state: TerraformState): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.stored(state);

      const { written } = state;

      if (written) {
        await this.context.db.insert(terraformStateVersion).values({
          id: written.id.value,
          stateId: state.id.value,
          number: written.number,
          serial: written.snapshot.serial,
          lineage: written.snapshot.lineage,
          md5: written.snapshot.md5,
          size: written.snapshot.size,
          writtenBy: written.writtenBy,
          writtenAt: written.writtenAt,
        });
      }

      await this.events.dispatch(state.pullEvents());
    });
  }

  async versionsBefore(
    state: TerraformState,
    number: number,
  ): Promise<readonly StateVersion[]> {
    const rows = await this.context.db
      .select()
      .from(terraformStateVersion)
      .where(
        and(
          eq(terraformStateVersion.stateId, state.id.value),
          lt(terraformStateVersion.number, number),
        ),
      );

    return rows.map(versionOf);
  }

  async removeVersions(
    state: TerraformState,
    versions: readonly StateVersion[],
  ): Promise<void> {
    if (versions.length === 0) {
      return;
    }

    await this.context.db.delete(terraformStateVersion).where(
      and(
        eq(terraformStateVersion.stateId, state.id.value),
        inArray(
          terraformStateVersion.id,
          versions.map((version) => version.id.value),
        ),
      ),
    );
  }

  async deleteForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.context.inTransaction(async () => {
      const states = await this.context.db
        .delete(terraformState)
        .where(eq(terraformState.workspaceId, workspaceId.value))
        .returning({ id: terraformState.id });

      if (states.length > 0) {
        await this.context.db.delete(terraformStateVersion).where(
          inArray(
            terraformStateVersion.stateId,
            states.map(({ id }) => id),
          ),
        );
      }
    });
  }

  private async stored(state: TerraformState): Promise<void> {
    const columns = {
      lock: lockRowOf(state.lock),
      latestVersionId: state.latest?.id.value ?? null,
    };

    if (state.isNew) {
      try {
        await this.context.db.insert(terraformState).values({
          id: state.id.value,
          workspaceId: state.workspaceId.value,
          name: state.name.value,
          ...columns,
        });
      } catch (error) {
        if (codeOf(error) === UNIQUE_VIOLATION) {
          throw new TerraformStateVersionConflictError(state.name.value);
        }

        throw error;
      }

      return;
    }

    const touched = await this.context.db
      .update(terraformState)
      .set({ ...columns, version: state.version + 1 })
      .where(
        and(
          eq(terraformState.id, state.id.value),
          eq(terraformState.version, state.version),
        ),
      )
      .returning({ id: terraformState.id });

    if (touched.length === 0) {
      throw new TerraformStateVersionConflictError(state.name.value);
    }
  }
}

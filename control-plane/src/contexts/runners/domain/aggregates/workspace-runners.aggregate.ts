import { WorkspaceRunnersCreated } from '@runners/domain/events/workspace-runners-created.event';
import { WorkspaceRunnersDeleted } from '@runners/domain/events/workspace-runners-deleted.event';
import { WorkspaceRunnersUpdated } from '@runners/domain/events/workspace-runners-updated.event';
import { InvalidWorkspaceRunnersError } from '@runners/domain/exceptions/invalid-workspace-runners.error';
import { WorkspaceRunnersVersionConflictError } from '@runners/domain/exceptions/workspace-runners-version-conflict.error';
import type { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import type { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import type { WorkspaceRunnersId } from '@runners/domain/value-objects/workspace-runners-id.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface Declaration {
  readonly trusts: readonly TrustKey[];
  readonly pools: readonly PoolKey[];
}

const rejectRepeated = <K extends { readonly value: string }>(
  field: 'trusts' | 'pools',
  keys: readonly K[],
): void => {
  for (const [at, key] of keys.entries()) {
    if (keys.findIndex((each) => each.value === key.value) !== at) {
      throw new InvalidWorkspaceRunnersError(
        field,
        at,
        `names ${key.value} twice`,
      );
    }
  }
};

const rejectRepeats = (declaration: Declaration): void => {
  rejectRepeated('trusts', declaration.trusts);
  rejectRepeated('pools', declaration.pools);
};

export class WorkspaceRunners extends EventRecorder {
  private constructor(
    readonly id: WorkspaceRunnersId,
    readonly workspaceId: WorkspaceId,
    readonly trusts: readonly TrustKey[],
    readonly pools: readonly PoolKey[],
    readonly version: number,
    readonly isDeleted: boolean,
  ) {
    super();
  }

  static create(
    input: Declaration & {
      id: WorkspaceRunnersId;
      workspaceId: WorkspaceId;
      by: ChangeActor;
    },
  ): WorkspaceRunners {
    rejectRepeats(input);

    const created = new WorkspaceRunners(
      input.id,
      input.workspaceId,
      input.trusts,
      input.pools,
      0,
      false,
    );

    created.record(
      new WorkspaceRunnersCreated(
        input.id,
        input.workspaceId,
        ConfigurationChange.created(created.whatChanged, input.by),
      ),
    );

    return created;
  }

  static rehydrate(
    input: Declaration & {
      id: WorkspaceRunnersId;
      workspaceId: WorkspaceId;
      version: number;
    },
  ): WorkspaceRunners {
    if (!Number.isInteger(input.version) || input.version < 0) {
      throw new InconsistentStateError(
        'workspace runners',
        `have an impossible version (${input.version})`,
      );
    }

    return new WorkspaceRunners(
      input.id,
      input.workspaceId,
      input.trusts,
      input.pools,
      input.version,
      false,
    );
  }

  assertVersion(version: number): void {
    if (version !== this.version) {
      throw new WorkspaceRunnersVersionConflictError(this.id.value);
    }
  }

  update(declaration: Declaration, by: ChangeActor): WorkspaceRunners {
    this.assertNotDeleted();
    rejectRepeats(declaration);

    const updated = this.with({
      trusts: declaration.trusts,
      pools: declaration.pools,
    });

    updated.record(
      new WorkspaceRunnersUpdated(
        this.id,
        this.workspaceId,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return updated;
  }

  delete(by: ChangeActor): WorkspaceRunners {
    this.assertNotDeleted();

    const deleted = this.with({ deleted: true });

    deleted.record(
      new WorkspaceRunnersDeleted(
        this.id,
        this.workspaceId,
        ConfigurationChange.deleted(this.whatChanged, by),
      ),
    );

    return deleted;
  }

  private get whatChanged() {
    return {
      resource: 'workspace-runners' as const,
      id: this.id.value,
      key: 'runners',
    };
  }

  private assertNotDeleted(): void {
    if (this.isDeleted) {
      throw new InconsistentStateError(
        'workspace runners',
        'were changed after they were deleted',
      );
    }
  }

  private with(part: {
    trusts?: readonly TrustKey[];
    pools?: readonly PoolKey[];
    deleted?: boolean;
  }): WorkspaceRunners {
    const next = new WorkspaceRunners(
      this.id,
      this.workspaceId,
      part.trusts ?? this.trusts,
      part.pools ?? this.pools,
      this.version,
      part.deleted ?? this.isDeleted,
    );

    next.inheritEvents(this);

    return next;
  }
}

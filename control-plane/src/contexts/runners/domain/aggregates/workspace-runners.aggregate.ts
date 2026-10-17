import { WorkspaceRunnersDeclared } from '@runners/domain/events/workspace-runners-declared.event';
import { WorkspaceRunnersDropped } from '@runners/domain/events/workspace-runners-dropped.event';
import { WorkspaceRunnersRedeclared } from '@runners/domain/events/workspace-runners-redeclared.event';
import { InvalidWorkspaceRunnersError } from '@runners/domain/exceptions/invalid-workspace-runners.error';
import { WorkspaceRunnersVersionConflictError } from '@runners/domain/exceptions/workspace-runners-version-conflict.error';
import type { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import type { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import type { WorkspaceRunnersId } from '@runners/domain/value-objects/workspace-runners-id.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
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
        `gives ${key.value} twice`,
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
    readonly isDropped: boolean,
  ) {
    super();
  }

  static declare(
    input: Declaration & {
      id: WorkspaceRunnersId;
      workspaceId: WorkspaceId;
      by: Attribution;
    },
  ): WorkspaceRunners {
    rejectRepeats(input);

    const declared = new WorkspaceRunners(
      input.id,
      input.workspaceId,
      input.trusts,
      input.pools,
      0,
      false,
    );

    declared.record(
      new WorkspaceRunnersDeclared(
        input.id,
        input.workspaceId,
        ConfigurationChange.created(declared.whatChanged, input.by),
      ),
    );

    return declared;
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

  redeclaredAs(declaration: Declaration, by: Attribution): WorkspaceRunners {
    this.assertNotDeleted();
    rejectRepeats(declaration);

    const redeclared = this.with({
      trusts: declaration.trusts,
      pools: declaration.pools,
    });

    redeclared.record(
      new WorkspaceRunnersRedeclared(
        this.id,
        this.workspaceId,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return redeclared;
  }

  drop(by: Attribution): WorkspaceRunners {
    this.assertNotDeleted();

    const dropped = this.with({ dropped: true });

    dropped.record(
      new WorkspaceRunnersDropped(
        this.id,
        this.workspaceId,
        ConfigurationChange.deleted(this.whatChanged, by),
      ),
    );

    return dropped;
  }

  private get whatChanged() {
    return {
      resource: 'workspace-runners' as const,
      id: this.id.value,
      key: 'runners',
    };
  }

  private assertNotDeleted(): void {
    if (this.isDropped) {
      throw new InconsistentStateError(
        'workspace runners',
        'were changed after they were dropped',
      );
    }
  }

  private with(part: {
    trusts?: readonly TrustKey[];
    pools?: readonly PoolKey[];
    dropped?: boolean;
  }): WorkspaceRunners {
    const next = new WorkspaceRunners(
      this.id,
      this.workspaceId,
      part.trusts ?? this.trusts,
      part.pools ?? this.pools,
      this.version,
      part.dropped ?? this.isDropped,
    );

    next.inheritEvents(this);

    return next;
  }
}

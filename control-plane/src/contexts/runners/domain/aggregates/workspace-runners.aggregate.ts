import { WorkspaceRunnersDeclared } from '@runners/domain/events/workspace-runners-declared.event';
import { WorkspaceRunnersDropped } from '@runners/domain/events/workspace-runners-dropped.event';
import { WorkspaceRunnersRedeclared } from '@runners/domain/events/workspace-runners-redeclared.event';
import { WorkspaceRunnersMovedOnError } from '@runners/domain/exceptions/workspace-runners-moved-on.error';
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

  expecting(version: number): void {
    if (version !== this.version) {
      throw new WorkspaceRunnersMovedOnError(this.id.value);
    }
  }

  redeclaredAs(declaration: Declaration, by: Attribution): WorkspaceRunners {
    this.guardStanding();

    const redeclared = this.reshaped({
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

  dropped(by: Attribution): WorkspaceRunners {
    this.guardStanding();

    const dropped = this.reshaped({ dropped: true });

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

  private guardStanding(): void {
    if (this.isDropped) {
      throw new InconsistentStateError(
        'workspace runners',
        'were changed after they were dropped',
      );
    }
  }

  private reshaped(part: {
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

import { RunnerTrustCreated } from '@runners/domain/events/runner-trust-created.event';
import { RunnerTrustDeleted } from '@runners/domain/events/runner-trust-deleted.event';
import { RunnerTrustUpdated } from '@runners/domain/events/runner-trust-updated.event';
import { RunnerTrustVersionConflictError } from '@runners/domain/exceptions/runner-trust-version-conflict.error';
import type { PoolMode } from '@runners/domain/value-objects/pool-access.vo';
import type { PoolCapacity } from '@runners/domain/value-objects/pool-capacity';
import type { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import type { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import type { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import type { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { WorkloadClaims } from '@shared-kernel/domain/value-objects/workload-claims.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface TrustDefinition {
  readonly key: TrustKey;
  readonly workload: TrustedWorkload;
  readonly labels: RunnerLabels;
}

export class RunnerTrust extends EventRecorder {
  private constructor(
    readonly id: RunnerTrustId,
    readonly workspaceId: WorkspaceId,
    readonly key: TrustKey,
    readonly workload: TrustedWorkload,
    readonly labels: RunnerLabels,
    readonly version: number,
    readonly isDeleted: boolean,
  ) {
    super();
  }

  static create(
    input: TrustDefinition & {
      id: RunnerTrustId;
      workspaceId: WorkspaceId;
      by: Attribution;
    },
  ): RunnerTrust {
    const created = new RunnerTrust(
      input.id,
      input.workspaceId,
      input.key,
      input.workload,
      input.labels,
      0,
      false,
    );

    created.record(
      new RunnerTrustCreated(
        created.id,
        created.workspaceId,
        created.key,
        ConfigurationChange.created(created.whatChanged, input.by),
      ),
    );

    return created;
  }

  static rehydrate(
    input: TrustDefinition & {
      id: RunnerTrustId;
      workspaceId: WorkspaceId;
      version: number;
    },
  ): RunnerTrust {
    if (!Number.isInteger(input.version) || input.version < 0) {
      throw new InconsistentStateError(
        'runner trust',
        `has an impossible version (${input.version})`,
      );
    }

    return new RunnerTrust(
      input.id,
      input.workspaceId,
      input.key,
      input.workload,
      input.labels,
      input.version,
      false,
    );
  }

  matches(claims: WorkloadClaims): boolean {
    return !this.isDeleted && this.workload.matches(claims);
  }

  capacity(mode: PoolMode): Exclude<PoolCapacity, 'full'> {
    return this.isDeleted || mode !== 'pull' ? 'gone' : 'open';
  }

  assertVersion(version: number): void {
    if (version !== this.version) {
      throw new RunnerTrustVersionConflictError(this.id.value);
    }
  }

  update(definition: TrustDefinition, by: Attribution): RunnerTrust {
    this.assertNotDeleted();

    if (!definition.key.equals(this.key)) {
      const because = `can't change its key to ${definition.key.value}. Please replace the trust instead`;

      throw new ImmutableFieldError(
        'key',
        because,
        `Runner trust ${this.key.value} ${because}.`,
      );
    }

    const updated = this.with({
      workload: definition.workload,
      labels: definition.labels,
    });

    updated.record(
      new RunnerTrustUpdated(
        this.id,
        this.workspaceId,
        this.key,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return updated;
  }

  delete(by: Attribution): RunnerTrust {
    this.assertNotDeleted();

    const deleted = this.with({ deleted: true });

    deleted.record(
      new RunnerTrustDeleted(
        this.id,
        this.workspaceId,
        this.key,
        ConfigurationChange.deleted(this.whatChanged, by),
      ),
    );

    return deleted;
  }

  private get whatChanged() {
    return {
      resource: 'runner-trust' as const,
      id: this.id.value,
      key: this.key.value,
    };
  }

  private assertNotDeleted(): void {
    if (this.isDeleted) {
      throw new InconsistentStateError(
        'runner trust',
        'was changed after it was deleted',
      );
    }
  }

  private with(part: {
    workload?: TrustedWorkload;
    labels?: RunnerLabels;
    deleted?: boolean;
  }): RunnerTrust {
    const next = new RunnerTrust(
      this.id,
      this.workspaceId,
      this.key,
      part.workload ?? this.workload,
      part.labels ?? this.labels,
      this.version,
      part.deleted ?? this.isDeleted,
    );

    next.inheritEvents(this);

    return next;
  }
}

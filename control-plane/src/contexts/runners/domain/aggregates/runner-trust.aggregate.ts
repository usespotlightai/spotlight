import { RunnerTrustDefined } from '@runners/domain/events/runner-trust-defined.event';
import { RunnerTrustRedefined } from '@runners/domain/events/runner-trust-redefined.event';
import { RunnerTrustWithdrawn } from '@runners/domain/events/runner-trust-withdrawn.event';
import { RunnerTrustKeyFixedError } from '@runners/domain/exceptions/runner-trust-key-fixed.error';
import { RunnerTrustVersionConflictError } from '@runners/domain/exceptions/runner-trust-version-conflict.error';
import type { PoolMode } from '@runners/domain/value-objects/pool-access.vo';
import type { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import type { RunnerTrustId } from '@runners/domain/value-objects/runner-trust-id.vo';
import type { StartVerdict } from '@runners/domain/value-objects/start-verdict';
import type { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import type { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
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
    readonly isWithdrawn: boolean,
  ) {
    super();
  }

  static define(
    input: TrustDefinition & {
      id: RunnerTrustId;
      workspaceId: WorkspaceId;
      by: Attribution;
    },
  ): RunnerTrust {
    const defined = new RunnerTrust(
      input.id,
      input.workspaceId,
      input.key,
      input.workload,
      input.labels,
      0,
      false,
    );

    defined.record(
      new RunnerTrustDefined(
        defined.id,
        defined.workspaceId,
        defined.key,
        ConfigurationChange.created(defined.whatChanged, input.by),
      ),
    );

    return defined;
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

  admits(claims: WorkloadClaims): boolean {
    return !this.isWithdrawn && this.workload.admits(claims);
  }

  startVerdict(mode: PoolMode): Exclude<StartVerdict, 'full'> {
    return this.isWithdrawn || mode !== 'pull' ? 'gone' : 'open';
  }

  assertVersion(version: number): void {
    if (version !== this.version) {
      throw new RunnerTrustVersionConflictError(this.id.value);
    }
  }

  redefinedAs(definition: TrustDefinition, by: Attribution): RunnerTrust {
    this.guardStanding();

    if (!definition.key.equals(this.key)) {
      throw new RunnerTrustKeyFixedError(
        this.key.value,
        `can't change its key to ${definition.key.value}. Please replace the trust instead`,
      );
    }

    const redefined = this.with({
      workload: definition.workload,
      labels: definition.labels,
    });

    redefined.record(
      new RunnerTrustRedefined(
        this.id,
        this.workspaceId,
        this.key,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return redefined;
  }

  withdraw(by: Attribution): RunnerTrust {
    this.guardStanding();

    const withdrawn = this.with({ withdrawn: true });

    withdrawn.record(
      new RunnerTrustWithdrawn(
        this.id,
        this.workspaceId,
        this.key,
        ConfigurationChange.deleted(this.whatChanged, by),
      ),
    );

    return withdrawn;
  }

  private get whatChanged() {
    return {
      resource: 'runner-trust' as const,
      id: this.id.value,
      key: this.key.value,
    };
  }

  private guardStanding(): void {
    if (this.isWithdrawn) {
      throw new InconsistentStateError(
        'runner trust',
        'was changed after it was withdrawn',
      );
    }
  }

  private with(part: {
    workload?: TrustedWorkload;
    labels?: RunnerLabels;
    withdrawn?: boolean;
  }): RunnerTrust {
    const next = new RunnerTrust(
      this.id,
      this.workspaceId,
      this.key,
      part.workload ?? this.workload,
      part.labels ?? this.labels,
      this.version,
      part.withdrawn ?? this.isWithdrawn,
    );

    next.inheritEvents(this);

    return next;
  }
}

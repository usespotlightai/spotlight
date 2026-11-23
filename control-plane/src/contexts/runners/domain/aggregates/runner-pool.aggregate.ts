import { RunnerPoolCreated } from '@runners/domain/events/runner-pool-created.event';
import { RunnerPoolDeleted } from '@runners/domain/events/runner-pool-deleted.event';
import { RunnerPoolUpdated } from '@runners/domain/events/runner-pool-updated.event';
import { InvalidRunnerPoolError } from '@runners/domain/exceptions/invalid-runner-pool.error';
import { RunnerPoolVersionConflictError } from '@runners/domain/exceptions/runner-pool-version-conflict.error';
import type { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import { EgressTraffic } from '@runners/domain/value-objects/egress-traffic.vo';
import type { EncryptedProvisionSecret } from '@runners/domain/value-objects/encrypted-provision-secret.vo';
import type { MaxRuns } from '@runners/domain/value-objects/max-runs.vo';
import {
  modeOf,
  PlatformAccess,
  type PlatformPoolAllowances,
  type PlatformPoolChange,
  type PoolAccess,
  type PoolMode,
  PullAccess,
  PushAccess,
} from '@runners/domain/value-objects/pool-access.vo';
import type { PoolCapacity } from '@runners/domain/value-objects/pool-capacity';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import type { PoolOccupancy } from '@runners/domain/value-objects/pool-occupancy.vo';
import type { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import { RotationVersion } from '@runners/domain/value-objects/rotation-version.vo';
import type { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerPoolChangeDetail } from '@runners/domain/value-objects/runner-pool-change-detail.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface PoolDefinition {
  readonly key: PoolKey;
  readonly labels: RunnerLabels;
  readonly maxRuns: MaxRuns | null;
}

export type AccessInput =
  | {
      readonly mode: 'pull';
      readonly tokenHash: TokenHash | null;
      readonly tokenVersion: number | null;
    }
  | {
      readonly mode: 'push';
      readonly url: ProvisionUrl;
      readonly secret: EncryptedProvisionSecret | null;
      readonly secretVersion: number | null;
      readonly egress: EgressReference | null;
      readonly egressTraffic?: EgressTraffic;
    };

// What the deployment sets for the platform pool of every workspace.
export interface PlatformPoolDefinition {
  readonly labels: RunnerLabels;
  readonly egress: EgressReference | null;
}

const SECRET_FIELD = 'provision.secret';

const sameEgress = (
  one: EgressReference | null,
  other: EgressReference | null,
): boolean =>
  one === null || other === null ? one === other : one.equals(other);

export class RunnerPool extends EventRecorder {
  private constructor(
    readonly id: PoolId,
    readonly workspaceId: WorkspaceId,
    readonly key: PoolKey,
    readonly labels: RunnerLabels,
    readonly maxRuns: MaxRuns | null,
    readonly access: PoolAccess,
    readonly version: number,
    readonly isDeleted: boolean,
  ) {
    super();
  }

  static create(
    input: PoolDefinition & {
      id: PoolId;
      workspaceId: WorkspaceId;
      access: AccessInput;
      by: ChangeActor;
    },
  ): RunnerPool {
    if (input.key.equals(PoolKey.platform())) {
      throw new InvalidRunnerPoolError(
        'key',
        `is ${input.key.value}, the key of the platform pool that Spotlight adds to each workspace. Please give the pool another key`,
      );
    }

    const access = RunnerPool.firstAccess(input.access);
    const created = new RunnerPool(
      input.id,
      input.workspaceId,
      input.key,
      input.labels,
      input.maxRuns,
      access,
      0,
      false,
    );

    created.record(
      new RunnerPoolCreated(
        created.id,
        created.workspaceId,
        created.key,
        ConfigurationChange.created(
          created.whatChanged,
          input.by,
          RunnerPoolChangeDetail.created(created.mode),
        ),
      ),
    );

    return created;
  }

  static createPlatform(
    input: PlatformPoolDefinition & {
      id: PoolId;
      workspaceId: WorkspaceId;
      // The work the new platform pool takes from the start. None when not given.
      allows?: PlatformPoolAllowances;
      by: ChangeActor;
    },
  ): RunnerPool {
    const created = new RunnerPool(
      input.id,
      input.workspaceId,
      PoolKey.platform(),
      input.labels,
      null,
      PlatformAccess.of(input.egress, false, input.allows),
      0,
      false,
    );

    created.record(
      new RunnerPoolCreated(
        created.id,
        created.workspaceId,
        created.key,
        ConfigurationChange.created(
          created.whatChanged,
          input.by,
          RunnerPoolChangeDetail.created(created.mode),
        ),
      ),
    );

    return created;
  }

  static rehydrate(
    input: PoolDefinition & {
      id: PoolId;
      workspaceId: WorkspaceId;
      access: PoolAccess;
      version: number;
    },
  ): RunnerPool {
    if (!Number.isInteger(input.version) || input.version < 0) {
      throw new InconsistentStateError(
        'runner pool',
        `has an impossible version (${input.version})`,
      );
    }

    const platform = input.access.kind === 'platform';

    if (
      platform &&
      (!input.key.equals(PoolKey.platform()) || input.maxRuns !== null)
    ) {
      throw new InconsistentStateError(
        'runner pool',
        `is a platform pool with key ${input.key.value} and run limit ${input.maxRuns?.value ?? 'none'}. A platform pool has key ${PoolKey.platform().value} and no run limit`,
      );
    }

    return new RunnerPool(
      input.id,
      input.workspaceId,
      input.key,
      input.labels,
      input.maxRuns,
      input.access,
      input.version,
      false,
    );
  }

  private static firstAccess(accessInput: AccessInput): PoolAccess {
    if (accessInput.mode === 'pull') {
      if (!accessInput.tokenHash) {
        throw new InconsistentStateError(
          'runner pool',
          'was created to pull with no token to claim with',
        );
      }

      return PullAccess.of(
        accessInput.tokenHash,
        RotationVersion.of(accessInput.tokenVersion),
      );
    }

    if (!accessInput.secret) {
      throw new InvalidRunnerPoolError(
        SECRET_FIELD,
        'is required for a pool that provisions',
      );
    }

    return PushAccess.of(
      accessInput.url,
      accessInput.secret,
      RotationVersion.of(accessInput.secretVersion),
      accessInput.egress,
      accessInput.egressTraffic,
    );
  }

  get mode(): PoolMode {
    return modeOf(this.access);
  }

  get isDisabled(): boolean {
    return this.access.kind === 'platform' && this.access.disabled;
  }

  get tokenHash(): TokenHash | null {
    return this.access.kind === 'pull' ? this.access.tokenHash : null;
  }

  get provision(): PushAccess | null {
    return this.access.kind === 'push' ? this.access : null;
  }

  get isPlatform(): boolean {
    return this.access.kind === 'platform';
  }

  // A pool of the workspace takes any work it fits. The platform pool takes runs that inject secrets only when the operator allows it.
  get allowsSecrets(): boolean {
    return this.access.kind !== 'platform' || this.access.allowsSecrets;
  }

  // A pool of the workspace takes any work it fits. The platform pool takes checks and diffs only when the operator allows it.
  get allowsReviewWork(): boolean {
    return this.access.kind !== 'platform' || this.access.allowsReviewWork;
  }

  // The deployment gives the provisioner of the platform pool. With no provisioner set, the platform pool provisions nothing.
  canProvision(platformPoolSet: boolean): boolean {
    return (
      !this.isDeleted &&
      this.mode === 'push' &&
      !this.isDisabled &&
      (platformPoolSet || !this.isPlatform)
    );
  }

  belongsTo(workspaceId: WorkspaceId): boolean {
    return this.workspaceId.equals(workspaceId);
  }

  get acceptsPullToken(): boolean {
    return !this.isDeleted && this.mode === 'pull';
  }

  get egress(): EgressReference | null {
    return this.access.kind === 'pull' ? null : this.access.egress;
  }

  get egressTraffic(): EgressTraffic {
    return this.access.kind === 'pull'
      ? EgressTraffic.all()
      : this.access.egressTraffic;
  }

  servesEgressNeed(needsEgress: boolean): boolean {
    return !needsEgress || this.egress !== null;
  }

  usesEgress(egress: EgressReference): boolean {
    return (
      !this.isDeleted &&
      this.access.kind !== 'pull' &&
      this.access.usesEgress(egress)
    );
  }

  roomFor(occupancy: PoolOccupancy): number | null {
    if (this.isDeleted || this.isDisabled) {
      return 0;
    }

    return this.maxRuns ? this.maxRuns.roomAfter(occupancy.taken) : null;
  }

  capacity(mode: PoolMode, occupancy: PoolOccupancy): PoolCapacity {
    if (this.isDeleted || this.isDisabled || mode !== this.mode) {
      return 'gone';
    }

    return (this.maxRuns?.allows(occupancy.taken) ?? true) ? 'open' : 'full';
  }

  assertVersion(version: number): void {
    if (version !== this.version) {
      throw new RunnerPoolVersionConflictError(this.id.value);
    }
  }

  update(
    definition: PoolDefinition,
    accessInput: AccessInput,
    by: ChangeActor,
  ): RunnerPool {
    this.assertNotDeleted();
    this.assertNotPlatform();

    if (!definition.key.equals(this.key)) {
      const because = `can't change its key to ${definition.key.value}. Please replace the pool instead`;

      throw new ImmutableFieldError(
        'key',
        because,
        `Runner pool ${this.key.value} ${because}.`,
      );
    }

    if (accessInput.mode !== this.mode) {
      const because = `can't change from ${this.mode === 'push' ? 'provisioning' : 'being pulled from'} to ${accessInput.mode === 'push' ? 'provisioning' : 'being pulled from'}. Please replace the pool instead`;

      throw new ImmutableFieldError(
        'provision',
        because,
        `Runner pool ${this.key.value} ${because}.`,
      );
    }

    const access = this.nextAccess(accessInput);
    const tokenRotated =
      access.kind === 'pull' &&
      this.access.kind === 'pull' &&
      !access.tokenHash.equals(this.access.tokenHash);
    const updated = this.with({
      labels: definition.labels,
      maxRuns: definition.maxRuns,
      access,
    });

    updated.record(
      new RunnerPoolUpdated(
        this.id,
        this.workspaceId,
        this.key,
        ConfigurationChange.updated(
          this.whatChanged,
          by,
          RunnerPoolChangeDetail.updated(this.mode, {
            tokenRotated,
            secretRotated:
              accessInput.mode === 'push' && accessInput.secret !== null,
            egressChanged:
              !sameEgress(this.egress, updated.egress) ||
              !this.egressTraffic.equals(updated.egressTraffic),
          }),
        ),
      ),
    );

    return updated;
  }

  // Gives the platform pool the labels and egress that the deployment sets now.
  reconcile(definition: PlatformPoolDefinition, by: ChangeActor): RunnerPool {
    const access = this.assertPlatform();
    const egressChanged = !sameEgress(access.egress, definition.egress);

    if (definition.labels.equals(this.labels) && !egressChanged) {
      return this;
    }

    return this.updatePlatform(
      {
        labels: definition.labels,
        access: access.withEgress(definition.egress),
      },
      by,
      { egressChanged },
    );
  }

  disable(by: ChangeActor): RunnerPool {
    return this.configure({ enabled: false }, by);
  }

  enable(by: ChangeActor): RunnerPool {
    return this.configure({ enabled: true }, by);
  }

  // The operator of the deployment enables or disables the platform pool of one workspace, and allows it runs that inject secrets, or checks and diffs. One change records one configuration change.
  configure(change: PlatformPoolChange, by: ChangeActor): RunnerPool {
    const access = this.assertPlatform();
    const next = access.changed(change);
    const moved = {
      ...(next.disabled === access.disabled ? {} : { disabled: next.disabled }),
      ...(next.allowsSecrets === access.allowsSecrets
        ? {}
        : { allowsSecrets: next.allowsSecrets }),
      ...(next.allowsReviewWork === access.allowsReviewWork
        ? {}
        : { allowsReviewWork: next.allowsReviewWork }),
    };

    if (Object.keys(moved).length === 0) {
      return this;
    }

    return this.updatePlatform({ access: next }, by, moved);
  }

  // Only Spotlight deletes the platform pool: when its workspace is deleted, or when the deployment sets no platform provisioner.
  delete(by: ChangeActor): RunnerPool {
    this.assertNotDeleted();

    if (this.isPlatform && by.actor !== null) {
      throw new InconsistentStateError(
        'runner pool',
        'is the platform pool, which only Spotlight deletes',
      );
    }

    const deleted = this.with({ deleted: true });

    deleted.record(
      new RunnerPoolDeleted(
        this.id,
        this.workspaceId,
        this.key,
        ConfigurationChange.deleted(this.whatChanged, by),
      ),
    );

    return deleted;
  }

  private updatePlatform(
    part: { labels?: RunnerLabels; access: PlatformAccess },
    by: ChangeActor,
    moved: {
      egressChanged?: boolean;
      disabled?: boolean;
      allowsSecrets?: boolean;
      allowsReviewWork?: boolean;
    },
  ): RunnerPool {
    const updated = this.with(part);

    updated.record(
      new RunnerPoolUpdated(
        this.id,
        this.workspaceId,
        this.key,
        ConfigurationChange.updated(
          this.whatChanged,
          by,
          RunnerPoolChangeDetail.updated(this.mode, {
            tokenRotated: false,
            secretRotated: false,
            ...moved,
          }),
        ),
      ),
    );

    return updated;
  }

  private assertPlatform(): PlatformAccess {
    this.assertNotDeleted();

    if (this.access.kind !== 'platform') {
      throw new InconsistentStateError(
        'runner pool',
        'was changed as the platform pool while its workspace owns it',
      );
    }

    return this.access;
  }

  private nextAccess(accessInput: AccessInput): PoolAccess {
    if (accessInput.mode === 'pull' && this.access.kind === 'pull') {
      if (
        !accessInput.tokenHash &&
        this.access.rotatesOn(RotationVersion.of(accessInput.tokenVersion))
      ) {
        throw new InvalidRunnerPoolError(
          'token',
          'is required whenever tokenVersion changes',
        );
      }

      return PullAccess.of(
        accessInput.tokenHash ?? this.access.tokenHash,
        RotationVersion.of(accessInput.tokenVersion),
      );
    }

    if (accessInput.mode === 'push' && this.access.kind === 'push') {
      if (
        !accessInput.secret &&
        this.access.rotatesOn(RotationVersion.of(accessInput.secretVersion))
      ) {
        throw new InvalidRunnerPoolError(
          SECRET_FIELD,
          'is required whenever provision.secretVersion changes',
        );
      }

      return PushAccess.of(
        accessInput.url,
        accessInput.secret ?? this.access.secret,
        RotationVersion.of(accessInput.secretVersion),
        accessInput.egress,
        accessInput.egressTraffic,
      );
    }

    throw new InconsistentStateError(
      'runner pool',
      'was given access in a mode it does not have',
    );
  }

  private get whatChanged() {
    return {
      resource: 'runner-pool' as const,
      id: this.id.value,
      key: this.key.value,
    };
  }

  private assertNotPlatform(): void {
    if (this.isPlatform) {
      throw new InconsistentStateError(
        'runner pool',
        'was changed as a workspace pool while it is the platform pool',
      );
    }
  }

  private assertNotDeleted(): void {
    if (this.isDeleted) {
      throw new InconsistentStateError(
        'runner pool',
        'was changed after it was deleted',
      );
    }
  }

  private with(part: {
    labels?: RunnerLabels;
    maxRuns?: MaxRuns | null;
    access?: PoolAccess;
    deleted?: boolean;
  }): RunnerPool {
    const next = new RunnerPool(
      this.id,
      this.workspaceId,
      this.key,
      part.labels ?? this.labels,
      part.maxRuns !== undefined ? part.maxRuns : this.maxRuns,
      part.access ?? this.access,
      this.version,
      part.deleted ?? this.isDeleted,
    );

    next.inheritEvents(this);

    return next;
  }
}

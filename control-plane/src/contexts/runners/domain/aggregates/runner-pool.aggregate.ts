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
  ManagedAccess,
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

// What the deployment sets for the pool that it manages in every workspace.
export interface ManagedDefinition {
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

  static createManaged(
    input: ManagedDefinition & {
      id: PoolId;
      workspaceId: WorkspaceId;
      by: ChangeActor;
    },
  ): RunnerPool {
    const created = new RunnerPool(
      input.id,
      input.workspaceId,
      PoolKey.managed(),
      input.labels,
      null,
      ManagedAccess.of(input.egress, false),
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

    if (
      input.access instanceof ManagedAccess &&
      (!input.key.equals(PoolKey.managed()) || input.maxRuns !== null)
    ) {
      throw new InconsistentStateError(
        'runner pool',
        `is a managed pool with key ${input.key.value} and run limit ${input.maxRuns?.value ?? 'none'}. A managed pool has key ${PoolKey.managed().value} and no run limit`,
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
    return this.access.mode;
  }

  get tokenHash(): TokenHash | null {
    return this.access.mode === 'pull' ? this.access.tokenHash : null;
  }

  get provision(): PushAccess | null {
    return this.access instanceof PushAccess ? this.access : null;
  }

  get isManaged(): boolean {
    return this.access instanceof ManagedAccess;
  }

  get isDisabled(): boolean {
    return this.access instanceof ManagedAccess && this.access.disabled;
  }

  get canProvision(): boolean {
    return !this.isDeleted && this.mode === 'push' && !this.isDisabled;
  }

  belongsTo(workspaceId: WorkspaceId): boolean {
    return this.workspaceId.equals(workspaceId);
  }

  get acceptsPullToken(): boolean {
    return !this.isDeleted && this.mode === 'pull';
  }

  get egress(): EgressReference | null {
    return this.access.mode === 'push' ? this.access.egress : null;
  }

  get egressTraffic(): EgressTraffic {
    return this.access.mode === 'push'
      ? this.access.egressTraffic
      : EgressTraffic.all();
  }

  servesEgressNeed(needsEgress: boolean): boolean {
    return !needsEgress || this.egress !== null;
  }

  usesEgress(egress: EgressReference): boolean {
    return (
      !this.isDeleted &&
      this.access.mode === 'push' &&
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
    this.assertNotManaged();

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
      access.mode === 'pull' &&
      this.access.mode === 'pull' &&
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

  // Gives a managed pool the labels and egress that the deployment sets now.
  reconcile(definition: ManagedDefinition, by: ChangeActor): RunnerPool {
    const access = this.managedAccess();
    const egressChanged = !sameEgress(access.egress, definition.egress);

    if (definition.labels.equals(this.labels) && !egressChanged) {
      return this;
    }

    return this.updateManaged(
      {
        labels: definition.labels,
        access: ManagedAccess.of(definition.egress, access.disabled),
      },
      by,
      { egressChanged },
    );
  }

  disable(by: ChangeActor): RunnerPool {
    return this.setDisabled(true, by);
  }

  enable(by: ChangeActor): RunnerPool {
    return this.setDisabled(false, by);
  }

  delete(by: ChangeActor): RunnerPool {
    this.assertNotDeleted();

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

  private setDisabled(disabled: boolean, by: ChangeActor): RunnerPool {
    const access = this.managedAccess();

    if (access.disabled === disabled) {
      return this;
    }

    return this.updateManaged(
      { access: ManagedAccess.of(access.egress, disabled) },
      by,
      { disabled },
    );
  }

  private updateManaged(
    part: { labels?: RunnerLabels; access: ManagedAccess },
    by: ChangeActor,
    moved: { egressChanged?: boolean; disabled?: boolean },
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

  private managedAccess(): ManagedAccess {
    this.assertNotDeleted();

    if (!(this.access instanceof ManagedAccess)) {
      throw new InconsistentStateError(
        'runner pool',
        'was changed as a managed pool while its workspace owns it',
      );
    }

    return this.access;
  }

  private nextAccess(accessInput: AccessInput): PoolAccess {
    if (accessInput.mode === 'pull' && this.access.mode === 'pull') {
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

    if (accessInput.mode === 'push' && this.access instanceof PushAccess) {
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

  private assertNotManaged(): void {
    if (this.isManaged) {
      throw new InconsistentStateError(
        'runner pool',
        'was changed as a workspace pool while the deployment manages it',
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

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
  type PoolAccess,
  type PoolMode,
  PullAccess,
  PushAccess,
} from '@runners/domain/value-objects/pool-access.vo';
import type { PoolCapacity } from '@runners/domain/value-objects/pool-capacity';
import type { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import type { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import type { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerPoolChangeDetail } from '@runners/domain/value-objects/runner-pool-change-detail.vo';
import type { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
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

const SECRET_FIELD = 'provision.secret';

const sameEgress = (
  one: EgressReference | null,
  other: EgressReference | null,
): boolean =>
  one === null || other === null ? one === other : one.equals(other);

export class RunnerPool extends EventRecorder {
  private constructor(
    readonly id: RunnerPoolId,
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
      id: RunnerPoolId;
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

  static rehydrate(
    input: PoolDefinition & {
      id: RunnerPoolId;
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

      return PullAccess.of(accessInput.tokenHash, accessInput.tokenVersion);
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
      accessInput.secretVersion,
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
    return this.access.mode === 'push' ? this.access : null;
  }

  belongsTo(workspaceId: WorkspaceId): boolean {
    return this.workspaceId.equals(workspaceId);
  }

  get egress(): EgressReference | null {
    return this.provision?.egress ?? null;
  }

  get egressTraffic(): EgressTraffic {
    return this.provision?.egressTraffic ?? EgressTraffic.all();
  }

  usesEgress(egress: EgressReference): boolean {
    return !this.isDeleted && (this.provision?.usesEgress(egress) ?? false);
  }

  hasRoomFor(running: number): boolean {
    return !this.isDeleted && (this.maxRuns?.allows(running) ?? true);
  }

  roomFor(running: number): number | null {
    if (this.isDeleted) {
      return 0;
    }

    return this.maxRuns ? this.maxRuns.roomAfter(running) : null;
  }

  capacity(mode: PoolMode, running: number): PoolCapacity {
    if (this.isDeleted || mode !== this.mode) {
      return 'gone';
    }

    return this.hasRoomFor(running) ? 'open' : 'full';
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

  private nextAccess(accessInput: AccessInput): PoolAccess {
    if (accessInput.mode === 'pull' && this.access.mode === 'pull') {
      if (
        !accessInput.tokenHash &&
        this.access.rotatesOn(accessInput.tokenVersion)
      ) {
        throw new InvalidRunnerPoolError(
          'token',
          'is required whenever tokenVersion changes',
        );
      }

      return PullAccess.of(
        accessInput.tokenHash ?? this.access.tokenHash,
        accessInput.tokenVersion,
      );
    }

    if (accessInput.mode === 'push' && this.access.mode === 'push') {
      if (
        !accessInput.secret &&
        this.access.rotatesOn(accessInput.secretVersion)
      ) {
        throw new InvalidRunnerPoolError(
          SECRET_FIELD,
          'is required whenever provision.secretVersion changes',
        );
      }

      return PushAccess.of(
        accessInput.url,
        accessInput.secret ?? this.access.secret,
        accessInput.secretVersion,
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

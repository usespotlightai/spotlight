import { EgressCreated } from '@runners/domain/events/egress-created.event';
import { EgressDeleted } from '@runners/domain/events/egress-deleted.event';
import { EgressUpdated } from '@runners/domain/events/egress-updated.event';
import { EgressInUseError } from '@runners/domain/exceptions/egress-in-use.error';
import { EgressVersionConflictError } from '@runners/domain/exceptions/egress-version-conflict.error';
import { InvalidEgressError } from '@runners/domain/exceptions/invalid-egress.error';
import { EgressChangeDetail } from '@runners/domain/value-objects/egress-change-detail.vo';
import type { EgressId } from '@runners/domain/value-objects/egress-id.vo';
import type { EgressKey } from '@runners/domain/value-objects/egress-key.vo';
import type { EgressUrl } from '@runners/domain/value-objects/egress-url.vo';
import type { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface EgressDefinition {
  readonly key: EgressKey;
  readonly url: EgressUrl;
}

export interface EgressTokenInput {
  readonly tokenHash: TokenHash | null;
  readonly tokenVersion: number | null;
}

export class Egress extends EventRecorder {
  private constructor(
    readonly id: EgressId,
    readonly workspaceId: WorkspaceId,
    readonly key: EgressKey,
    readonly url: EgressUrl,
    readonly tokenHash: TokenHash,
    readonly tokenVersion: number | null,
    readonly version: number,
    readonly isDeleted: boolean,
  ) {
    super();
  }

  static create(
    input: EgressDefinition & {
      id: EgressId;
      workspaceId: WorkspaceId;
      token: EgressTokenInput;
      by: Attribution;
    },
  ): Egress {
    if (!input.token.tokenHash) {
      throw new InconsistentStateError(
        'egress',
        'was created with no token to call Spotlight with',
      );
    }

    const created = new Egress(
      input.id,
      input.workspaceId,
      input.key,
      input.url,
      input.token.tokenHash,
      input.token.tokenVersion,
      0,
      false,
    );

    created.record(
      new EgressCreated(
        created.id,
        created.workspaceId,
        created.key,
        ConfigurationChange.created(created.whatChanged, input.by),
      ),
    );

    return created;
  }

  static rehydrate(
    input: EgressDefinition & {
      id: EgressId;
      workspaceId: WorkspaceId;
      tokenHash: TokenHash;
      tokenVersion: number | null;
      version: number;
    },
  ): Egress {
    if (!Number.isInteger(input.version) || input.version < 0) {
      throw new InconsistentStateError(
        'egress',
        `has an impossible version (${input.version})`,
      );
    }

    return new Egress(
      input.id,
      input.workspaceId,
      input.key,
      input.url,
      input.tokenHash,
      input.tokenVersion,
      input.version,
      false,
    );
  }

  belongsTo(workspaceId: WorkspaceId): boolean {
    return this.workspaceId.equals(workspaceId);
  }

  assertVersion(version: number): void {
    if (version !== this.version) {
      throw new EgressVersionConflictError(this.id.value);
    }
  }

  update(
    definition: EgressDefinition,
    tokenInput: EgressTokenInput,
    by: Attribution,
  ): Egress {
    this.assertNotDeleted();

    if (!definition.key.equals(this.key)) {
      const because = `can't change its key to ${definition.key.value}. Please replace the egress instead`;

      throw new ImmutableFieldError(
        'key',
        because,
        `Egress ${this.key.value} ${because}.`,
      );
    }

    if (
      !tokenInput.tokenHash &&
      tokenInput.tokenVersion !== this.tokenVersion
    ) {
      throw new InvalidEgressError(
        'token',
        'is required whenever tokenVersion changes',
      );
    }

    const tokenHash = tokenInput.tokenHash ?? this.tokenHash;
    const updated = this.with({
      url: definition.url,
      tokenHash,
      tokenVersion: tokenInput.tokenVersion,
    });

    updated.record(
      new EgressUpdated(
        this.id,
        this.workspaceId,
        this.key,
        ConfigurationChange.updated(
          this.whatChanged,
          by,
          EgressChangeDetail.updated({
            rekeyed: !tokenHash.equals(this.tokenHash),
          }),
        ),
      ),
    );

    return updated;
  }

  delete(namedBy: readonly PoolKey[], by: Attribution): Egress {
    this.assertNotDeleted();

    if (namedBy.length > 0) {
      throw new EgressInUseError(
        this.key.value,
        namedBy.map((each) => each.value),
      );
    }

    const deleted = this.with({ deleted: true });

    deleted.record(
      new EgressDeleted(
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
      resource: 'egress' as const,
      id: this.id.value,
      key: this.key.value,
    };
  }

  private assertNotDeleted(): void {
    if (this.isDeleted) {
      throw new InconsistentStateError(
        'egress',
        'was changed after it was deleted',
      );
    }
  }

  private with(part: {
    url?: EgressUrl;
    tokenHash?: TokenHash;
    tokenVersion?: number | null;
    deleted?: boolean;
  }): Egress {
    const next = new Egress(
      this.id,
      this.workspaceId,
      this.key,
      part.url ?? this.url,
      part.tokenHash ?? this.tokenHash,
      part.tokenVersion !== undefined ? part.tokenVersion : this.tokenVersion,
      this.version,
      part.deleted ?? this.isDeleted,
    );

    next.inheritEvents(this);

    return next;
  }
}

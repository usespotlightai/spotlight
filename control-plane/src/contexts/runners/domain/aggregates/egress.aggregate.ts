import { EgressDefined } from '@runners/domain/events/egress-defined.event';
import { EgressRedefined } from '@runners/domain/events/egress-redefined.event';
import { EgressRetired } from '@runners/domain/events/egress-retired.event';
import { EgressInUseError } from '@runners/domain/exceptions/egress-in-use.error';
import { EgressKeyFixedError } from '@runners/domain/exceptions/egress-key-fixed.error';
import { EgressVersionConflictError } from '@runners/domain/exceptions/egress-version-conflict.error';
import { InvalidEgressError } from '@runners/domain/exceptions/invalid-egress.error';
import { EgressChangeDetail } from '@runners/domain/value-objects/egress-change-detail.vo';
import type { EgressId } from '@runners/domain/value-objects/egress-id.vo';
import type { EgressKey } from '@runners/domain/value-objects/egress-key.vo';
import type { EgressUrl } from '@runners/domain/value-objects/egress-url.vo';
import type { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface EgressDefinition {
  readonly key: EgressKey;
  readonly url: EgressUrl;
}

export interface GivenEgressToken {
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
    readonly isRetired: boolean,
  ) {
    super();
  }

  static define(
    input: EgressDefinition & {
      id: EgressId;
      workspaceId: WorkspaceId;
      token: GivenEgressToken;
      by: Attribution;
    },
  ): Egress {
    if (!input.token.tokenHash) {
      throw new InconsistentStateError(
        'egress',
        'was defined with no token to call Spotlight with',
      );
    }

    const defined = new Egress(
      input.id,
      input.workspaceId,
      input.key,
      input.url,
      input.token.tokenHash,
      input.token.tokenVersion,
      0,
      false,
    );

    defined.record(
      new EgressDefined(
        defined.id,
        defined.workspaceId,
        defined.key,
        ConfigurationChange.created(defined.whatChanged, input.by),
      ),
    );

    return defined;
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

  redefinedAs(
    definition: EgressDefinition,
    given: GivenEgressToken,
    by: Attribution,
  ): Egress {
    this.guardStanding();

    if (!definition.key.equals(this.key)) {
      throw new EgressKeyFixedError(
        this.key.value,
        `can't change its key to ${definition.key.value}. Please replace the egress instead`,
      );
    }

    if (!given.tokenHash && given.tokenVersion !== this.tokenVersion) {
      throw new InvalidEgressError(
        'token',
        'is required whenever tokenVersion changes',
      );
    }

    const tokenHash = given.tokenHash ?? this.tokenHash;
    const redefined = this.with({
      url: definition.url,
      tokenHash,
      tokenVersion: given.tokenVersion,
    });

    redefined.record(
      new EgressRedefined(
        this.id,
        this.workspaceId,
        this.key,
        ConfigurationChange.updated(
          this.whatChanged,
          by,
          EgressChangeDetail.redefined({
            rekeyed: !tokenHash.equals(this.tokenHash),
          }),
        ),
      ),
    );

    return redefined;
  }

  retire(namedBy: readonly PoolKey[], by: Attribution): Egress {
    this.guardStanding();

    if (namedBy.length > 0) {
      throw new EgressInUseError(
        this.key.value,
        namedBy.map((each) => each.value),
      );
    }

    const retired = this.with({ retired: true });

    retired.record(
      new EgressRetired(
        this.id,
        this.workspaceId,
        this.key,
        ConfigurationChange.deleted(this.whatChanged, by),
      ),
    );

    return retired;
  }

  private get whatChanged() {
    return {
      resource: 'egress' as const,
      id: this.id.value,
      key: this.key.value,
    };
  }

  private guardStanding(): void {
    if (this.isRetired) {
      throw new InconsistentStateError(
        'egress',
        'was changed after it was retired',
      );
    }
  }

  private with(part: {
    url?: EgressUrl;
    tokenHash?: TokenHash;
    tokenVersion?: number | null;
    retired?: boolean;
  }): Egress {
    const next = new Egress(
      this.id,
      this.workspaceId,
      this.key,
      part.url ?? this.url,
      part.tokenHash ?? this.tokenHash,
      part.tokenVersion !== undefined ? part.tokenVersion : this.tokenVersion,
      this.version,
      part.retired ?? this.isRetired,
    );

    next.inheritEvents(this);

    return next;
  }
}

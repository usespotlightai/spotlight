import { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import { OidcTrustCreated } from '@identity/domain/events/oidc-trust-created.event';
import { OidcTrustDeleted } from '@identity/domain/events/oidc-trust-deleted.event';
import { OidcTrustUpdated } from '@identity/domain/events/oidc-trust-updated.event';
import { OidcTrustVersionConflictError } from '@identity/domain/exceptions/oidc-trust-version-conflict.error';
import { ScopesExceedCallerError } from '@identity/domain/exceptions/scopes-exceed-caller.error';
import { WorkloadNotMatchedError } from '@identity/domain/exceptions/workload-not-matched.error';
import type { OidcTrustKey } from '@identity/domain/value-objects/oidc-trust-key.vo';
import type { ScopeCeiling } from '@identity/domain/value-objects/scope-ceiling.vo';
import type { TokenLifetime } from '@identity/domain/value-objects/token-lifetime.vo';
import { TokenName } from '@identity/domain/value-objects/token-name.vo';
import type { WorkloadRule } from '@identity/domain/value-objects/workload-rule.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import type { Client } from '@shared-kernel/domain/value-objects/client.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { OidcTrustId } from '@shared-kernel/domain/value-objects/oidc-trust-id.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkloadClaims } from '@shared-kernel/domain/value-objects/workload-claims.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';

export interface OidcTrustSpec {
  readonly key: OidcTrustKey;
  readonly workload: WorkloadRule;
  readonly scopes: TokenScopes;
  readonly lifetime: TokenLifetime;
}

interface Props extends OidcTrustSpec {
  readonly id: OidcTrustId;
  readonly workspaceId: WorkspaceId;
  readonly createdBy: UserId;
  readonly createdAt: Date;
  readonly version: number;
}

interface State extends Props {
  readonly deleted: boolean;
}

export class OidcTrust extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static create(
    input: OidcTrustSpec & {
      id: OidcTrustId;
      workspaceId: WorkspaceId;
      createdBy: UserId;
      scopeCeiling: ScopeCeiling;
      by: ChangeActor;
      now: Date;
    },
  ): OidcTrust {
    if (!input.scopeCeiling.allows(input.scopes)) {
      throw new ScopesExceedCallerError(input.key.value);
    }

    const created = new OidcTrust({
      id: input.id,
      workspaceId: input.workspaceId,
      key: input.key,
      workload: input.workload,
      scopes: input.scopes,
      lifetime: input.lifetime,
      createdBy: input.createdBy,
      createdAt: input.now,
      version: 0,
      deleted: false,
    });

    created.record(
      new OidcTrustCreated(
        created.id,
        created.workspaceId,
        created.key,
        ConfigurationChange.created(created.whatChanged, input.by),
      ),
    );

    return created;
  }

  static rehydrate(input: Props): OidcTrust {
    if (!Number.isInteger(input.version) || input.version < 0) {
      throw new InconsistentStateError(
        'OIDC trust',
        `has an impossible version (${input.version})`,
      );
    }

    return new OidcTrust({ ...input, deleted: false });
  }

  assertVersion(version: number): void {
    if (version !== this.version) {
      throw new OidcTrustVersionConflictError(this.id.value);
    }
  }

  update(
    spec: OidcTrustSpec,
    scopeCeiling: ScopeCeiling,
    by: ChangeActor,
  ): OidcTrust {
    this.assertNotDeleted();
    this.guardWithin(scopeCeiling);

    if (!scopeCeiling.allows(spec.scopes)) {
      throw new ScopesExceedCallerError(this.key.value);
    }

    if (!spec.key.equals(this.key)) {
      const because = `cannot change its key to ${spec.key.value}`;

      throw new ImmutableFieldError(
        'key',
        because,
        `OIDC trust ${this.key.value} ${because}.`,
      );
    }

    if (this.hasSpec(spec)) {
      return this;
    }

    const updated = this.with({
      workload: spec.workload,
      scopes: spec.scopes,
      lifetime: spec.lifetime,
    });

    updated.record(
      new OidcTrustUpdated(
        this.id,
        this.workspaceId,
        this.key,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return updated;
  }

  delete(scopeCeiling: ScopeCeiling, by: ChangeActor): OidcTrust {
    this.assertNotDeleted();
    this.guardWithin(scopeCeiling);

    const deleted = this.with({ deleted: true });

    deleted.record(
      new OidcTrustDeleted(
        this.id,
        this.workspaceId,
        this.key,
        ConfigurationChange.deleted(this.whatChanged, by),
      ),
    );

    return deleted;
  }

  matches(workload: WorkloadClaims): boolean {
    return !this.isDeleted && this.workload.matches(workload);
  }

  issueFor(
    workload: WorkloadClaims,
    issued: {
      id: WorkspaceTokenId;
      hash: TokenHash;
      now: Date;
      client: Client;
    },
  ): WorkspaceToken {
    if (!this.matches(workload)) {
      throw new WorkloadNotMatchedError(this.key.value);
    }

    return WorkspaceToken.issueByTrust({
      id: issued.id,
      workspaceId: this.workspaceId,
      name: TokenName.of(this.key.value),
      scopes: this.scopes,
      expiresAt: this.lifetime.endingFrom(issued.now),
      hash: issued.hash,
      issuedBy: this.createdBy,
      issuedByTrustId: this.id,
      trustVersion: this.version,
      subject: workload.subject,
      now: issued.now,
      client: issued.client,
    });
  }

  stillGrants(token: WorkspaceToken): boolean {
    return (
      !this.isDeleted &&
      token.issuedByTrustId?.equals(this.id) === true &&
      token.trustVersion === this.version
    );
  }

  get id(): OidcTrustId {
    return this.state.id;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get key(): OidcTrustKey {
    return this.state.key;
  }

  get workload(): WorkloadRule {
    return this.state.workload;
  }

  get scopes(): TokenScopes {
    return this.state.scopes;
  }

  get lifetime(): TokenLifetime {
    return this.state.lifetime;
  }

  get createdBy(): UserId {
    return this.state.createdBy;
  }

  get createdAt(): Date {
    return this.state.createdAt;
  }

  get version(): number {
    return this.state.version;
  }

  get isDeleted(): boolean {
    return this.state.deleted;
  }

  private get whatChanged() {
    return {
      resource: 'oidc-trust' as const,
      id: this.id.value,
      key: this.key.value,
    };
  }

  private hasSpec(spec: OidcTrustSpec): boolean {
    return (
      spec.workload.equals(this.workload) &&
      spec.scopes.equals(this.scopes) &&
      spec.lifetime.equals(this.lifetime)
    );
  }

  private guardWithin(scopeCeiling: ScopeCeiling): void {
    if (!scopeCeiling.allows(this.scopes)) {
      throw new ScopesExceedCallerError(this.key.value);
    }
  }

  private assertNotDeleted(): void {
    if (this.isDeleted) {
      throw new InconsistentStateError(
        'OIDC trust',
        'was changed after it was deleted',
      );
    }
  }

  private with(change: Partial<State>): OidcTrust {
    const next = new OidcTrust({ ...this.state, ...change });

    next.inheritEvents(this);

    return next;
  }
}

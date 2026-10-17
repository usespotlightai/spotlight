import { WorkspaceToken } from '@identity/domain/aggregates/workspace-token.aggregate';
import { WorkspaceTokenTrustCreated } from '@identity/domain/events/workspace-token-trust-created.event';
import { WorkspaceTokenTrustDeleted } from '@identity/domain/events/workspace-token-trust-deleted.event';
import { WorkspaceTokenTrustUpdated } from '@identity/domain/events/workspace-token-trust-updated.event';
import { TokenTrustBeyondGrantorError } from '@identity/domain/exceptions/token-trust-beyond-grantor.error';
import { TokenTrustVersionConflictError } from '@identity/domain/exceptions/token-trust-version-conflict.error';
import { WorkloadNotAdmittedError } from '@identity/domain/exceptions/workload-not-admitted.error';
import type { Grantor } from '@identity/domain/value-objects/grantor.vo';
import type { TokenLifetime } from '@identity/domain/value-objects/token-lifetime.vo';
import { TokenName } from '@identity/domain/value-objects/token-name.vo';
import type { TokenTrustKey } from '@identity/domain/value-objects/token-trust-key.vo';
import type { WorkloadRule } from '@identity/domain/value-objects/workload-rule.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import type { Client } from '@shared-kernel/domain/value-objects/client.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkloadClaims } from '@shared-kernel/domain/value-objects/workload-claims.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import type { WorkspaceTokenTrustId } from '@shared-kernel/domain/value-objects/workspace-token-trust-id.vo';

export interface TokenTrustTerms {
  readonly key: TokenTrustKey;
  readonly workload: WorkloadRule;
  readonly scopes: TokenScopes;
  readonly lifetime: TokenLifetime;
}

interface Props extends TokenTrustTerms {
  readonly id: WorkspaceTokenTrustId;
  readonly workspaceId: WorkspaceId;
  readonly createdBy: UserId;
  readonly version: number;
}

interface State extends Props {
  readonly deleted: boolean;
}

export class WorkspaceTokenTrust extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static create(
    input: TokenTrustTerms & {
      id: WorkspaceTokenTrustId;
      workspaceId: WorkspaceId;
      createdBy: UserId;
      grantor: Grantor;
      by: Attribution;
    },
  ): WorkspaceTokenTrust {
    if (!input.grantor.covers(input.scopes)) {
      throw new TokenTrustBeyondGrantorError(input.key.value);
    }

    const created = new WorkspaceTokenTrust({
      id: input.id,
      workspaceId: input.workspaceId,
      key: input.key,
      workload: input.workload,
      scopes: input.scopes,
      lifetime: input.lifetime,
      createdBy: input.createdBy,
      version: 0,
      deleted: false,
    });

    created.record(
      new WorkspaceTokenTrustCreated(
        created.id,
        created.workspaceId,
        created.key,
        ConfigurationChange.created(created.whatChanged, input.by),
      ),
    );

    return created;
  }

  static rehydrate(input: Props): WorkspaceTokenTrust {
    if (!Number.isInteger(input.version) || input.version < 0) {
      throw new InconsistentStateError(
        'workspace token trust',
        `has an impossible version (${input.version})`,
      );
    }

    return new WorkspaceTokenTrust({ ...input, deleted: false });
  }

  assertVersion(version: number): void {
    if (version !== this.version) {
      throw new TokenTrustVersionConflictError(this.id.value);
    }
  }

  update(
    terms: TokenTrustTerms,
    grantor: Grantor,
    by: Attribution,
  ): WorkspaceTokenTrust {
    this.assertNotDeleted();
    this.guardWithin(grantor);

    if (!grantor.covers(terms.scopes)) {
      throw new TokenTrustBeyondGrantorError(this.key.value);
    }

    if (!terms.key.equals(this.key)) {
      const because = `cannot change its key to ${terms.key.value}`;

      throw new ImmutableFieldError(
        'key',
        because,
        `Token trust ${this.key.value} ${because}.`,
      );
    }

    if (this.hasTerms(terms)) {
      return this;
    }

    const updated = this.with({
      workload: terms.workload,
      scopes: terms.scopes,
      lifetime: terms.lifetime,
    });

    updated.record(
      new WorkspaceTokenTrustUpdated(
        this.id,
        this.workspaceId,
        this.key,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return updated;
  }

  delete(grantor: Grantor, by: Attribution): WorkspaceTokenTrust {
    this.assertNotDeleted();
    this.guardWithin(grantor);

    const deleted = this.with({ deleted: true });

    deleted.record(
      new WorkspaceTokenTrustDeleted(
        this.id,
        this.workspaceId,
        this.key,
        ConfigurationChange.deleted(this.whatChanged, by),
      ),
    );

    return deleted;
  }

  admits(workload: WorkloadClaims): boolean {
    return !this.isDeleted && this.workload.admits(workload);
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
    if (!this.admits(workload)) {
      throw new WorkloadNotAdmittedError(this.key.value);
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

  get id(): WorkspaceTokenTrustId {
    return this.state.id;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get key(): TokenTrustKey {
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

  get version(): number {
    return this.state.version;
  }

  get isDeleted(): boolean {
    return this.state.deleted;
  }

  private get whatChanged() {
    return {
      resource: 'workspace-token-trust' as const,
      id: this.id.value,
      key: this.key.value,
    };
  }

  private hasTerms(terms: TokenTrustTerms): boolean {
    return (
      terms.workload.equals(this.workload) &&
      terms.scopes.equals(this.scopes) &&
      terms.lifetime.equals(this.lifetime)
    );
  }

  private guardWithin(grantor: Grantor): void {
    if (!grantor.covers(this.scopes)) {
      throw new TokenTrustBeyondGrantorError(this.key.value);
    }
  }

  private assertNotDeleted(): void {
    if (this.isDeleted) {
      throw new InconsistentStateError(
        'workspace token trust',
        'was changed after it was deleted',
      );
    }
  }

  private with(change: Partial<State>): WorkspaceTokenTrust {
    const next = new WorkspaceTokenTrust({ ...this.state, ...change });

    next.inheritEvents(this);

    return next;
  }
}
